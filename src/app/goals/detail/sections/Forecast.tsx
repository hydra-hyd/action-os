"use client";

import Link from "next/link";
import { useState } from "react";
import { pct } from "@/components/goals";
import { Badge, Button, Card, SectionTitle, Stat } from "@/components/ui";
import { addDays, changePlan, diagnose, forecastGoal, setGoalStatus } from "@/lib/domain/goals";
import type { SectionProps } from "./types";

const CONFIDENCE_LABEL = { insufficient: "データ不足（予測しません）", low: "低い（データが少ない）", medium: "中程度" };
const KIND_LABEL = { psych: "心理的な阻害", plan: "計画上の問題", resource: "リソース不足", structure: "目標間の矛盾" };

export function ForecastSection({ s, dispatch, goal, now, goTab }: SectionProps) {
  const f = forecastGoal(s, goal.id, now);
  const issues = diagnose(s, now).filter((d) => d.goalId === goal.id);
  const [extend, setExtend] = useState(30);
  const openTask = s.tasks.find((t) => t.goalId === goal.id && !["done", "cancelled"].includes(t.status));
  const fmtPace = (v: number | null) => (v === null ? "—" : `週 ${(v * 100).toFixed(1)}%`);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>計画と実績・達成予測</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="現在の進捗" value={pct(f.progress)} />
          <Stat label="計画上の進捗" value={pct(f.planned)} sub={f.gap === null ? "期限未設定" : `差 ${f.gap >= 0 ? "+" : ""}${Math.round(f.gap * 100)}pt`} />
          <Stat label="残り期間" value={f.daysLeft === null ? "—" : `${f.daysLeft}日`} sub={`残り作業 ${pct(f.remaining)}`} />
          <Stat label="想定完了日" value={f.projectedDate ?? "—"} sub={f.delayDays === null ? undefined : f.delayDays > 0 ? `${f.delayDays}日遅れの見込み` : `${-f.delayDays}日前倒しの見込み`} />
          <Stat label="現在のペース" value={fmtPace(f.pacePerWeek)} sub="直近90日の進捗推移から" />
          <Stat label="必要なペース" value={fmtPace(f.requiredPacePerWeek)} />
          <Stat label="予測の確かさ" value={CONFIDENCE_LABEL[f.confidence]} sub={`データ点 ${f.dataPoints}`} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">予測は記録された進捗の推移から計算した推定値で、達成を保証しません。進捗はマイルストーンの達成・KPI の記録・タスク完了で更新されます。</p>
        {f.confidence !== "insufficient" && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="py-1">シナリオ</th>
                  <th>想定完了日</th>
                  <th>補足</th>
                </tr>
              </thead>
              <tbody>
                {f.scenarios.map((sc) => (
                  <tr key={sc.label} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 pr-2">{sc.label}</td>
                    <td className="pr-2 tabular-nums">{sc.projectedDate ?? "—"}</td>
                    <td className="text-xs text-zinc-500">{sc.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>戦略参謀の指摘（ルールベース）</SectionTitle>
        {issues.length === 0 ? (
          <p className="text-sm text-zinc-500">現時点で検出された問題はありません。</p>
        ) : (
          <ul className="space-y-3">
            {issues.map((d, i) => (
              <li key={i} className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">
                <div className="flex items-center gap-2">
                  <Badge tone={d.level === "warn" ? "amber" : "zinc"}>{KIND_LABEL[d.kind]}</Badge>
                  <span>{d.message}</span>
                </div>
                <ul className="mt-1 list-disc pl-6 text-zinc-600 dark:text-zinc-400">
                  {d.suggestions.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                {d.kind === "psych" && openTask && (
                  <Link href={`/stuck?task=${openTask.id}`} className="mt-2 inline-block text-emerald-700 underline dark:text-emerald-400">
                    「{openTask.title}」で行動できない理由に対処する
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>計画を修正する（承認制・履歴に残ります）</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-sm font-medium">期限を延長する</div>
            <div className="mt-2 flex items-center gap-2">
              <select className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700" value={extend} onChange={(e) => setExtend(Number(e.target.value))} aria-label="延長日数">
                {[7, 14, 30, 60, 90, 180].map((n) => (
                  <option key={n} value={n}>{n}日</option>
                ))}
              </select>
              <Button
                disabled={!goal.dueDate}
                onClick={() => {
                  const next = addDays(goal.dueDate!, extend);
                  if (confirm(`期限を ${goal.dueDate} → ${next} に変更しますか？`)) dispatch((st) => changePlan(st, goal.id, { dueDate: next }, `期限を${extend}日延長（${goal.dueDate} → ${next}）`));
                }}
              >
                延長
              </Button>
            </div>
            {!goal.dueDate && <p className="mt-1 text-xs text-zinc-500">期限が未設定です</p>}
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-sm font-medium">代替プランに切り替える</div>
            <p className="mt-1 text-xs text-zinc-500">現在：プラン{goal.activePlan.toUpperCase()}</p>
            <Button className="mt-2" onClick={() => goTab("risks")}>プランA・B・Cを見る</Button>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-sm font-medium">マイルストーン・範囲を見直す</div>
            <p className="mt-1 text-xs text-zinc-500">期限の引き直し、不要な範囲の削除、重要度の調整</p>
            <Button className="mt-2" onClick={() => goTab("milestones")}>マイルストーンを編集</Button>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-sm font-medium">状態を見直す</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={() => dispatch((st) => setGoalStatus(st, goal.id, "needs_review"))}>要見直しにする</Button>
              <Button variant="ghost" onClick={() => confirm("この目標を一時停止しますか？（実績は消えません）") && dispatch((st) => setGoalStatus(st, goal.id, "paused"))}>
                一時停止
              </Button>
              <Button variant="ghost" onClick={() => confirm("この目標を撤回しますか？撤回も正当な選択です。（実績は消えません）") && dispatch((st) => setGoalStatus(st, goal.id, "withdrawn"))}>
                撤回
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
