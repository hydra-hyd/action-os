"use client";

import Link from "next/link";
import { GoalsNav, goalHref } from "@/components/goals";
import { Badge, Card, Field, PageHeader, SectionTitle, inputClass, useNow } from "@/components/ui";
import { FOCUS_LABEL, diagnose, resourceSummary, updateGoal } from "@/lib/domain/goals";
import { useAppState, useHydrated } from "@/lib/store";

const KIND_LABEL = { psych: "心理的な阻害", plan: "計画上の問題", resource: "リソース不足", structure: "目標間の矛盾・集中" };
const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

export default function ResourcesPage() {
  const [s, dispatch] = useAppState();
  const hydrated = useHydrated();
  const now = useNow(60_000);
  if (!hydrated) return <div className="h-64" />;

  const p = s.settings.planning;
  const setP = (patch: Partial<typeof p>) => dispatch((st) => ({ ...st, settings: { ...st.settings, planning: { ...st.settings.planning, ...patch } } }));
  const r = resourceSummary(s, now);
  const issues = diagnose(s, now);
  const maxBar = Math.max(r.available, r.allocated, 1);

  return (
    <div className="space-y-4">
      <PageHeader title="リソース・戦略参謀" sub="複数の目標が時間・お金・体力を奪い合っていないかを確認します。" />
      <GoalsNav />

      <Card>
        <SectionTitle>使える時間</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="1週間に目標へ使える時間（h）" hint="大学・仕事・睡眠・家事などの固定予定を除いた時間">
            <input type="number" min={0} step={0.5} className={inputClass} value={p.weeklyAvailableHours} onChange={(e) => setP({ weeklyAvailableHours: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="予備時間の割合" hint="体調不良・急な予定のための余白">
            <select className={inputClass} value={p.reserveRatio} onChange={(e) => setP({ reserveRatio: Number(e.target.value) })}>
              {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((n) => (
                <option key={n} value={n}>{Math.round(n * 100)}%</option>
              ))}
            </select>
          </Field>
          <Field label="生まれ年（任意・ロードマップの年齢表示用）">
            <input type="number" min={1900} max={2100} className={inputClass} value={p.birthYear ?? ""} onChange={(e) => setP({ birthYear: e.target.value ? Number(e.target.value) : null })} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>目標別の時間配分（今週）</SectionTitle>
        <div className="mb-3">
          <div className="flex justify-between text-sm">
            <span>配分合計 {r.allocated.toFixed(1)}h</span>
            <span className={r.overloaded ? "font-semibold text-rose-600" : "text-zinc-500"}>
              利用可能 {r.available.toFixed(1)}h{r.overloaded ? "（過密）" : ""}
            </span>
          </div>
          <div className="relative mt-1 h-3 rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className={`h-full rounded-full ${r.overloaded ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${(r.allocated / maxBar) * 100}%` }} />
            <div className="absolute -top-1 h-5 w-0.5 bg-zinc-800 dark:bg-zinc-200" style={{ left: `${(r.available / maxBar) * 100}%` }} title="利用可能時間" />
          </div>
        </div>
        {r.byGoal.length === 0 ? (
          <p className="text-sm text-zinc-500">実行中の目標がありません。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="py-1">目標</th>
                <th>区分</th>
                <th className="text-right">配分（h/週）</th>
                <th className="text-right">今週の実績</th>
              </tr>
            </thead>
            <tbody>
              {r.byGoal.map(({ goal, planned, actualThisWeek }) => (
                <tr key={goal.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5">
                    <Link href={goalHref(goal.id)} className="hover:underline">{goal.title}</Link>
                  </td>
                  <td className="text-xs text-zinc-500">{FOCUS_LABEL[goal.focus]}</td>
                  <td className="text-right">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className="w-20 rounded border border-zinc-300 bg-transparent px-1 text-right dark:border-zinc-700"
                      value={goal.weeklyHours ?? ""}
                      onChange={(e) => dispatch((st) => updateGoal(st, goal.id, { weeklyHours: e.target.value ? Number(e.target.value) : null }))}
                      aria-label={`${goal.title}の週あたり配分時間`}
                    />
                  </td>
                  <td className={`text-right tabular-nums ${planned > 0 && actualThisWeek < planned * 0.5 ? "text-amber-600" : ""}`}>{actualThisWeek.toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-zinc-500">実績は、目標に紐づくタスクの集中モードの記録から集計しています。</p>
      </Card>

      <Card>
        <SectionTitle>資金</SectionTitle>
        {r.budget.length === 0 ? (
          <p className="text-sm text-zinc-500">予算を設定した目標はありません（目標詳細の「概要」で設定できます）。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="py-1">目標</th>
                <th className="text-right">予算</th>
                <th className="text-right">使用済み</th>
                <th className="text-right">残り</th>
              </tr>
            </thead>
            <tbody>
              {r.budget.map((b) => (
                <tr key={b.goal.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5">{b.goal.title}</td>
                  <td className="text-right tabular-nums">{yen(b.budget)}</td>
                  <td className="text-right tabular-nums">{yen(b.spent)}</td>
                  <td className={`text-right tabular-nums ${b.remaining < 0 ? "text-rose-600" : ""}`}>{yen(b.remaining)}</td>
                </tr>
              ))}
              <tr className="border-t border-zinc-200 font-semibold dark:border-zinc-700">
                <td className="py-1.5">合計</td>
                <td className="text-right tabular-nums">{yen(r.budget.reduce((a, b) => a + b.budget, 0))}</td>
                <td className="text-right tabular-nums">{yen(r.budget.reduce((a, b) => a + b.spent, 0))}</td>
                <td className="text-right tabular-nums">{yen(r.budget.reduce((a, b) => a + b.remaining, 0))}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <SectionTitle>戦略参謀（ルールベース診断・AI未接続）</SectionTitle>
        <p className="mb-3 text-xs text-zinc-500">過密・矛盾・遅れ・前提不足を機械的に検出します。遅れは「心理的な阻害」「計画上の問題」「リソース不足」を区別して示します。提案は参考であり、計画の変更はあなたが行います。</p>
        {issues.length === 0 ? (
          <p className="text-sm text-zinc-500">現時点で検出された問題はありません。</p>
        ) : (
          <ul className="space-y-3">
            {issues.map((d, i) => (
              <li key={i} className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={d.level === "warn" ? "amber" : "zinc"}>{KIND_LABEL[d.kind]}</Badge>
                  <span>{d.message}</span>
                  {d.goalId && (
                    <Link href={goalHref(d.goalId)} className="text-xs text-emerald-700 underline dark:text-emerald-400">目標を開く</Link>
                  )}
                </div>
                <ul className="mt-1 list-disc pl-6 text-zinc-600 dark:text-zinc-400">
                  {d.suggestions.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
