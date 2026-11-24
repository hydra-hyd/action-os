"use client";

import Link from "next/link";
import { useState } from "react";
import { GoalsNav, goalHref, pct } from "@/components/goals";
import { Button, Card, PageHeader, useNow } from "@/components/ui";
import { OPEN_STATUSES, addDays, goalHealth, goalProgress, parseDay, plannedProgress, toDay } from "@/lib/domain/goals";
import type { Goal } from "@/lib/domain/types";
import { useAppState, useHydrated } from "@/lib/store";

type Scale = "week" | "month" | "quarter" | "year" | "all";
const SCALE_DAYS: Record<Exclude<Scale, "all">, number> = { week: 14, month: 62, quarter: 184, year: 730 };
const SCALE_LABEL: Record<Scale, string> = { week: "週", month: "月", quarter: "四半期", year: "年", all: "全体" };

export default function GanttPage() {
  const [s] = useAppState();
  const hydrated = useHydrated();
  const now = useNow(60_000);
  const [scale, setScale] = useState<Scale>("quarter");
  const [showMs, setShowMs] = useState(true);
  const [showDone, setShowDone] = useState(false);
  if (!hydrated) return <div className="h-64" />;

  const today = toDay(now);
  const goals = s.goals.filter((g) => (showDone ? g.status !== "withdrawn" : OPEN_STATUSES.includes(g.status)));
  // 階層順に並べる
  const ordered: { g: Goal; depth: number }[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const g of goals.filter((x) => (x.parentId ?? null) === parent || (parent === null && x.parentId && !goals.some((p) => p.id === x.parentId)))) {
      if (ordered.some((o) => o.g.id === g.id)) continue;
      ordered.push({ g, depth });
      visit(g.id, depth + 1);
    }
  };
  visit(null, 0);

  const startOf = (g: Goal) => g.startDate ?? toDay(new Date(g.createdAt));
  let from: string;
  let to: string;
  if (scale === "all") {
    const dates = ordered.flatMap(({ g }) => [startOf(g), g.dueDate ?? today]).concat(today);
    from = dates.reduce((a, b) => (a < b ? a : b));
    to = addDays(dates.reduce((a, b) => (a > b ? a : b)), 7);
  } else {
    from = addDays(today, -Math.round(SCALE_DAYS[scale] * 0.25));
    to = addDays(from, SCALE_DAYS[scale]);
  }
  const span = Math.max(1, parseDay(to).getTime() - parseDay(from).getTime());
  const x = (d: string) => ((parseDay(d).getTime() - parseDay(from).getTime()) / span) * 100;
  const clampX = (v: number) => Math.min(100, Math.max(0, v));

  // 目盛り
  const ticks: { label: string; pos: number }[] = [];
  const f = parseDay(from);
  const unitMonths = scale === "week" ? 0 : scale === "month" ? 1 : scale === "quarter" ? 1 : scale === "year" ? 3 : Math.max(1, Math.round(span / (86400000 * 30 * 8)));
  if (unitMonths === 0) {
    for (let i = 0; i <= 14; i += 2) {
      const d = addDays(from, i);
      ticks.push({ label: `${parseDay(d).getMonth() + 1}/${parseDay(d).getDate()}`, pos: x(d) });
    }
  } else {
    const c = new Date(f.getFullYear(), f.getMonth() + 1, 1);
    while (toDay(c) < to) {
      ticks.push({ label: c.getMonth() === 0 ? `${c.getFullYear()}年` : `${c.getMonth() + 1}月`, pos: x(toDay(c)) });
      c.setMonth(c.getMonth() + unitMonths);
    }
  }
  const todayX = x(today);

  return (
    <div className="space-y-4">
      <PageHeader title="ガントチャート" sub="目標とマイルストーンの期間、計画と実績の差、遅れを表示します。" />
      <GoalsNav />
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(SCALE_LABEL) as Scale[]).map((k) => (
          <Button key={k} variant={scale === k ? "secondary" : "ghost"} onClick={() => setScale(k)} aria-pressed={scale === k}>
            {SCALE_LABEL[k]}
          </Button>
        ))}
        <label className="ml-2 flex items-center gap-1 text-sm">
          <input type="checkbox" className="size-4 accent-emerald-600" checked={showMs} onChange={(e) => setShowMs(e.target.checked)} />
          マイルストーン
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" className="size-4 accent-emerald-600" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          完了・停止も表示
        </label>
      </div>

      <Card className="overflow-x-auto p-0">
        {ordered.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">表示する目標がありません。</p>
        ) : (
          <div className="min-w-[720px]">
            <div className="relative ml-56 h-7 border-b border-zinc-200 text-[11px] text-zinc-500 dark:border-zinc-800">
              {ticks.map((t) => (
                <span key={t.label + t.pos} className="absolute top-1.5 -translate-x-1/2 whitespace-nowrap" style={{ left: `${t.pos}%` }}>
                  {t.label}
                </span>
              ))}
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 right-0 left-56">
                {ticks.map((t) => (
                  <div key={t.label + t.pos} className="absolute inset-y-0 w-px bg-zinc-100 dark:bg-zinc-800/70" style={{ left: `${t.pos}%` }} />
                ))}
                {todayX >= 0 && todayX <= 100 && (
                  <div className="absolute inset-y-0 z-10 w-0.5 bg-rose-500" style={{ left: `${todayX}%` }} title={`今日 ${today}`} />
                )}
              </div>
              {ordered.map(({ g, depth }) => {
                const st = startOf(g);
                const end = g.dueDate ?? addDays(st, 30);
                const left = clampX(x(st));
                const right = clampX(x(end));
                const pr = goalProgress(s, g.id).value;
                const planned = plannedProgress(s, g.id, now);
                const h = goalHealth(s, g.id, now);
                const color = h === "overdue" ? "bg-rose-400" : h === "behind" ? "bg-amber-400" : h === "done" ? "bg-emerald-300" : "bg-sky-400";
                const ms = showMs ? s.milestones.filter((m) => m.goalId === g.id && m.dueDate) : [];
                const deps = g.dependsOn.map((d) => s.goals.find((x2) => x2.id === d)?.title).filter(Boolean);
                return (
                  <div key={g.id} className="border-b border-zinc-100 dark:border-zinc-800/70">
                    <div className="flex h-10 items-center">
                      <Link href={goalHref(g.id)} className="w-56 shrink-0 truncate px-3 text-sm hover:underline" style={{ paddingLeft: `${12 + depth * 14}px` }} title={g.title}>
                        {depth > 0 && "└ "}
                        {g.title}
                      </Link>
                      <div className="relative h-full flex-1">
                        {right > left && (
                          <Link
                            href={goalHref(g.id)}
                            className={`absolute top-2.5 h-5 overflow-hidden rounded ${color} ${!g.dueDate ? "opacity-40" : ""}`}
                            style={{ left: `${left}%`, width: `${Math.max(0.5, right - left)}%` }}
                            title={`${g.title}\n${st} 〜 ${g.dueDate ?? "期限未設定"}\n実績 ${pct(pr)} / 計画 ${pct(planned)}${deps.length ? `\n依存：${deps.join("、")}` : ""}`}
                          >
                            <div className="h-full bg-black/20" style={{ width: `${pr * 100}%` }} />
                            {planned !== null && <div className="absolute inset-y-0 w-0.5 bg-zinc-900/70" style={{ left: `${planned * 100}%` }} />}
                          </Link>
                        )}
                      </div>
                    </div>
                    {ms.map((m) => {
                      const late = !m.done && m.dueDate! < today;
                      const ml = m.startDate ? clampX(x(m.startDate)) : null;
                      const mr = clampX(x(m.dueDate!));
                      return (
                        <div key={m.id} className="flex h-7 items-center">
                          <span className="w-56 shrink-0 truncate px-3 text-xs text-zinc-500" style={{ paddingLeft: `${26 + depth * 14}px` }} title={m.title}>
                            ◆ {m.title}
                          </span>
                          <div className="relative h-full flex-1">
                            {ml !== null && mr > ml && (
                              <div className={`absolute top-2.5 h-2 rounded ${m.done ? "bg-emerald-300" : late ? "bg-rose-300" : "bg-zinc-300 dark:bg-zinc-600"}`} style={{ left: `${ml}%`, width: `${mr - ml}%` }} />
                            )}
                            {x(m.dueDate!) >= 0 && x(m.dueDate!) <= 100 && (
                              <div
                                className={`absolute top-1.5 size-3 -translate-x-1/2 rotate-45 ${m.done ? "bg-emerald-500" : late ? "bg-rose-500" : "bg-zinc-500"}`}
                                style={{ left: `${mr}%` }}
                                title={`${m.title}：${m.dueDate}${m.done ? "（達成）" : late ? "（期限超過）" : ""}`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
        <span><span className="mr-1 inline-block size-3 rounded bg-sky-400 align-middle" />計画どおり・判定不可</span>
        <span><span className="mr-1 inline-block size-3 rounded bg-amber-400 align-middle" />遅れ気味</span>
        <span><span className="mr-1 inline-block size-3 rounded bg-rose-400 align-middle" />期限超過</span>
        <span>濃い部分＝実績の進捗、黒い縦線＝計画上の位置、赤い縦線＝今日</span>
      </div>
      <p className="text-xs text-zinc-400">期間の変更は目標・マイルストーンの詳細画面で行います（ドラッグでの変更とクリティカルパス表示は未実装）。</p>
    </div>
  );
}
