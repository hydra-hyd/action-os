"use client";

import { useState } from "react";
import { Card, PageHeader, SectionTitle, Stat, Button, useNow } from "@/components/ui";
import {
  blockerDistribution,
  completionRate,
  focusMs,
  formatRate,
  habitRate,
  interventionStartRate,
  medianStartDelayMin,
  minimumRate,
  recoveryRate,
  startRate,
  type Period,
} from "@/lib/domain/kpi";
import { BLOCKER_LABEL, TECHNIQUES } from "@/lib/domain/techniques";
import type { AppState } from "@/lib/domain/types";
import { formatDuration, localDate, startOfWeek } from "@/lib/domain/util";
import { useAppState, useHydrated } from "@/lib/store";

type Range = "day" | "week" | "month";

function periodFor(range: Range, now: Date, offset = 0): Period {
  if (range === "day") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    return { from, to: new Date(from.getTime() + 86400000) };
  }
  if (range === "week") {
    const from = startOfWeek(now);
    from.setDate(from.getDate() - 7 * offset);
    return { from, to: new Date(from.getTime() + 7 * 86400000) };
  }
  const from = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return { from, to: new Date(now.getFullYear(), now.getMonth() - offset + 1, 1) };
}

function KpiGrid({ s, p, now }: { s: AppState; p: Period; now: Date }) {
  const delay = medianStartDelayMin(s, p);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat label="タスク着手率" value={formatRate(startRate(s, p))} />
      <Stat label="タスク完了率" value={formatRate(completionRate(s, p))} />
      <Stat label="最低目標以上の達成率" value={formatRate(minimumRate(s, p))} />
      <Stat label="着手遅延（中央値）" value={delay === null ? "データなし" : `${Math.round(delay)}分`} />
      <Stat label="中断後の復帰率" value={formatRate(recoveryRate(s, p))} />
      <Stat label="習慣実行率" value={formatRate(habitRate(s, p, now))} />
      <Stat label="心理介入後の着手率" value={formatRate(interventionStartRate(s, p))} sub="10分以内に着手" />
      <Stat label="集中時間" value={formatDuration(focusMs(s, p, now))} />
    </div>
  );
}

export default function AnalyticsPage() {
  const [s] = useAppState();
  const hydrated = useHydrated();
  const now = useNow(60_000);
  const [range, setRange] = useState<Range>("week");

  if (!hydrated) return <div className="h-64" />;

  const cur = periodFor(range, now);
  const prev = periodFor(range, now, 1);
  const curFocus = focusMs(s, cur, now);
  const prevFocus = focusMs(s, prev, now);

  // 直近14日の集中時間と完了数
  const days = Array.from({ length: 14 }, (_, i) => {
    const p = periodFor("day", now, 13 - i);
    const done = s.actionLogs.filter((l) => (l.type === "complete" || l.type === "minimum") && new Date(l.at) >= p.from && new Date(l.at) < p.to).length;
    return { key: localDate(p.from), label: `${p.from.getMonth() + 1}/${p.from.getDate()}`, focusMin: focusMs(s, p, now) / 60000, done };
  });
  const maxFocus = Math.max(1, ...days.map((d) => d.focusMin));

  // 行動時間ヒートマップ（着手ログの時間帯 × 曜日）
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const l of s.actionLogs.filter((x) => x.type === "start" || x.type === "resume")) {
    const d = new Date(l.at);
    heat[d.getDay()][d.getHours()]++;
  }
  const maxHeat = Math.max(1, ...heat.flat());

  const dist = blockerDistribution(s, cur);
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0);

  // 心理テクニック別の着手率（介入後10分以内に着手したか）
  const byTech = TECHNIQUES.map((t) => {
    const ivs = s.interventions.filter((i) => i.techniqueId === t.id && i.taskId);
    const started = ivs.filter((i) =>
      s.actionLogs.some((l) => l.taskId === i.taskId && ["start", "resume", "minimum"].includes(l.type) && new Date(l.at).getTime() - new Date(i.at).getTime() >= 0 && new Date(l.at).getTime() - new Date(i.at).getTime() <= 600000),
    ).length;
    return { name: t.name, n: ivs.length, started };
  }).filter((x) => x.n > 0);

  return (
    <div className="space-y-4">
      <PageHeader title="行動分析" sub="アプリの利用時間ではなく、現実の行動を振り返るための画面です。相関は因果ではなく、改善のための仮説として見てください。" />

      <div className="flex gap-1" role="tablist">
        {(["day", "week", "month"] as Range[]).map((r) => (
          <Button key={r} variant={range === r ? "secondary" : "ghost"} onClick={() => setRange(r)} role="tab" aria-selected={range === r}>
            {{ day: "今日", week: "今週", month: "今月" }[r]}
          </Button>
        ))}
      </div>

      <Card>
        <SectionTitle>主要指標</SectionTitle>
        <KpiGrid s={s} p={cur} now={now} />
        <p className="mt-2 text-xs text-zinc-500">
          {range === "day" ? "前日" : range === "week" ? "前週" : "前月"}の集中時間：{formatDuration(prevFocus)}
          {prevFocus > 0 && `（${curFocus >= prevFocus ? "+" : "−"}${formatDuration(Math.abs(curFocus - prevFocus))}）`}
        </p>
        <p className="mt-1 text-[11px] text-zinc-400">着手率・完了率は「行動予定時刻」がこの期間にあるタスクが対象。分母が0のときは「データなし」と表示します。</p>
      </Card>

      <Card>
        <SectionTitle>直近14日の集中時間</SectionTitle>
        <div className="flex h-36 items-end gap-1" role="img" aria-label="直近14日の集中時間の棒グラフ">
          {days.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] text-zinc-500 tabular-nums">{d.focusMin >= 1 ? Math.round(d.focusMin) : ""}</span>
              <div className="w-full rounded-t bg-emerald-500" style={{ height: `${(d.focusMin / maxFocus) * 100}%`, minHeight: d.focusMin > 0 ? 2 : 0 }} title={`${d.label}: ${Math.round(d.focusMin)}分 / 完了${d.done}`} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {days.map((d, i) => (
            <span key={d.key} className="flex-1 text-center text-[10px] text-zinc-400">{i % 2 === 0 ? d.label : ""}</span>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-zinc-400">単位：分</p>
      </Card>

      <Card>
        <SectionTitle>行動しやすい時間帯（着手の記録）</SectionTitle>
        <div className="overflow-x-auto">
          <table className="text-[10px]">
            <thead>
              <tr>
                <th />
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="w-4 font-normal text-zinc-400">{h % 3 === 0 ? h : ""}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heat.map((row, d) => (
                <tr key={d}>
                  <th className="pr-1 font-normal text-zinc-500">{"日月火水木金土"[d]}</th>
                  {row.map((v, h) => (
                    <td key={h} title={`${"日月火水木金土"[d]} ${h}時: ${v}回`}>
                      <div className="m-px size-3.5 rounded-sm bg-emerald-500" style={{ opacity: v === 0 ? 0.08 : 0.25 + (v / maxHeat) * 0.75 }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <SectionTitle>先延ばしの原因（この期間）</SectionTitle>
          {distTotal === 0 ? (
            <p className="text-sm text-zinc-500">データなし</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(dist)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <li key={k} className="text-sm">
                    <div className="flex justify-between">
                      <span>{BLOCKER_LABEL[k as keyof typeof BLOCKER_LABEL]}</span>
                      <span className="tabular-nums text-zinc-500">{v}回</span>
                    </div>
                    <div className="h-1.5 rounded bg-zinc-200 dark:bg-zinc-800">
                      <div className="h-full rounded bg-amber-500" style={{ width: `${(v / distTotal) * 100}%` }} />
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card>
        <Card>
          <SectionTitle>心理テクニック別の着手（全期間）</SectionTitle>
          {byTech.length === 0 ? (
            <p className="text-sm text-zinc-500">データなし</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {byTech.map((t) => (
                <li key={t.name} className="flex justify-between gap-2">
                  <span className="truncate">{t.name}</span>
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {Math.round((t.started / t.n) * 100)}%（{t.started}/{t.n}）
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-zinc-400">件数が少ないうちは偶然の影響が大きい点に注意してください。</p>
        </Card>
      </div>
    </div>
  );
}
