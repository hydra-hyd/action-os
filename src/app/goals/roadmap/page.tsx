"use client";

import Link from "next/link";
import { useState } from "react";
import { GoalsNav, HealthBadge, goalHref, pct } from "@/components/goals";
import { Badge, Card, PageHeader, inputClass, useNow } from "@/components/ui";
import { GOAL_STATUS_LABEL, HORIZON_LABEL, goalProgress, parseDay } from "@/lib/domain/goals";
import { useAppState, useHydrated } from "@/lib/store";

type Item = { key: string; date: string; kind: "goal" | "milestone"; title: string; goalId: string; done: boolean };

export default function RoadmapPage() {
  const [s] = useAppState();
  const hydrated = useHydrated();
  const now = useNow(60_000);
  const [category, setCategory] = useState("");
  const [showDone, setShowDone] = useState(true);
  if (!hydrated) return <div className="h-64" />;

  const birthYear = s.settings.planning.birthYear;
  const goals = s.goals.filter((g) => g.status !== "withdrawn" && (!category || g.category === category));
  const goalIds = new Set(goals.map((g) => g.id));
  const items: Item[] = [
    ...goals.filter((g) => g.dueDate).map((g) => ({ key: g.id, date: g.dueDate!, kind: "goal" as const, title: g.title, goalId: g.id, done: g.status === "achieved" })),
    ...s.milestones
      .filter((m) => m.dueDate && goalIds.has(m.goalId))
      .map((m) => ({ key: m.id, date: m.dueDate!, kind: "milestone" as const, title: m.title, goalId: m.goalId, done: m.done })),
  ]
    .filter((i) => showDone || !i.done)
    .sort((a, b) => a.date.localeCompare(b.date));
  const undated = goals.filter((g) => !g.dueDate);
  const byYear = new Map<number, Item[]>();
  for (const i of items) {
    const y = parseDay(i.date).getFullYear();
    byYear.set(y, [...(byYear.get(y) ?? []), i]);
  }
  const categories = [...new Set(s.goals.map((g) => g.category))];
  const thisYear = now.getFullYear();

  return (
    <div className="space-y-4">
      <PageHeader title="人生ロードマップ" sub="目標とマイルストーンを年ごとに並べます。年齢を表示するには「リソース・戦略参謀」で生まれ年を設定してください（任意）。" />
      <GoalsNav />
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputClass} w-48`} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="カテゴリーで絞り込む">
          <option value="">すべてのカテゴリー</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-emerald-600" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          達成済みも表示
        </label>
      </div>

      {items.length === 0 && undated.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">期限のある目標・マイルストーンがありません。</p>
        </Card>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-zinc-200 pl-5 dark:border-zinc-800">
          {[...byYear.entries()].map(([year, list]) => (
            <li key={year}>
              <div className={`absolute -left-[7px] mt-1.5 size-3 rounded-full ${year === thisYear ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`} />
              <h2 className="text-lg font-semibold">
                {year}年{birthYear && <span className="ml-2 text-sm font-normal text-zinc-500">{year - birthYear}歳になる年</span>}
                {year === thisYear && <Badge tone="emerald">今年</Badge>}
              </h2>
              <ul className="mt-2 space-y-1.5">
                {list.map((i) => {
                  const g = s.goals.find((x) => x.id === i.goalId)!;
                  return (
                    <li key={i.key}>
                      <Link href={goalHref(i.goalId)} className="flex flex-wrap items-center gap-2 rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
                        <span className="w-20 shrink-0 text-xs tabular-nums text-zinc-500">{i.date.slice(5)}</span>
                        {i.kind === "goal" ? <Badge tone="sky">目標</Badge> : <Badge>◆ マイルストーン</Badge>}
                        <span className={`${i.kind === "goal" ? "font-semibold" : ""} ${i.done ? "text-zinc-400 line-through" : ""}`}>{i.title}</span>
                        {i.kind === "goal" ? (
                          <>
                            <HealthBadge s={s} id={g.id} now={now} />
                            <span className="text-xs text-zinc-500">
                              {HORIZON_LABEL[g.horizon]} ・ {g.category} ・ {GOAL_STATUS_LABEL[g.status]} ・ 進捗 {pct(goalProgress(s, g.id).value)}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-500">（{g.title}）</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {undated.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">期限未設定の目標</h2>
          <ul className="space-y-1 text-sm">
            {undated.map((g) => (
              <li key={g.id}>
                <Link href={goalHref(g.id)} className="hover:underline">{g.title}</Link> <span className="text-xs text-zinc-500">（{HORIZON_LABEL[g.horizon]}）</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
