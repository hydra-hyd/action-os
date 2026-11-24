"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, SectionTitle, inputClass } from "@/components/ui";
import { CRITERIA, addStrategy, deleteStrategy, selectStrategy, strategyScore, strategyTemplates, updateGoal, updateStrategy } from "@/lib/domain/goals";
import type { CriterionKey } from "@/lib/domain/types";
import { tryDispatch, type SectionProps } from "./types";

export function StrategySection({ s, dispatch, goal }: SectionProps) {
  const list = s.strategies.filter((x) => x.goalId === goal.id);
  const [months, setMonths] = useState(12);
  const [hours, setHours] = useState(goal.weeklyHours ?? 7);
  const [cost, setCost] = useState(goal.budget ?? 0);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const w = goal.matrixWeights;
  const ranked = [...list].sort((a, b) => strategyScore(b, w) - strategyScore(a, w));

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>複数の戦略を作る</SectionTitle>
        <p className="mb-3 text-xs text-zinc-500">
          <Badge>ルールベース（AI未接続）</Badge> 標準プランの見積もりをもとに、最速・標準・低負荷・低予算・リスク低減の5案を作ります。数値とスコアは機械的な初期値なので、実情に合わせて直してください。根拠のない成功確率は表示しません。
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="標準の期間（か月）">
            <input type="number" min={1} className={inputClass} value={months} onChange={(e) => setMonths(Number(e.target.value) || 1)} />
          </Field>
          <Field label="標準の週あたり時間（h）">
            <input type="number" min={0} step={0.5} className={inputClass} value={hours} onChange={(e) => setHours(Number(e.target.value) || 0)} />
          </Field>
          <Field label="標準の費用（円）">
            <input type="number" min={0} className={inputClass} value={cost} onChange={(e) => setCost(Number(e.target.value) || 0)} />
          </Field>
          <div className="flex items-end">
            <Button variant="primary" onClick={() => dispatch((st) => strategyTemplates({ months, hoursPerWeek: hours, cost }).reduce((x, t) => addStrategy(x, goal.id, t), st))}>
              5つのシナリオを追加
            </Button>
          </div>
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (tryDispatch(dispatch, (st) => addStrategy(st, goal.id, { name }), setError)) setName("");
          }}
        >
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="独自の戦略名（例：予備校に通う）" aria-label="独自の戦略名" />
          <Button type="submit">独自の戦略を追加</Button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </Card>

      <Card>
        <SectionTitle>評価項目の重み（意思決定マトリクス）</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {CRITERIA.map((c) => (
            <label key={c.key} className="text-sm">
              <div className="flex justify-between">
                <span>{c.label}</span>
                <span className="tabular-nums text-zinc-500">{w[c.key]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                value={w[c.key]}
                onChange={(e) => dispatch((st) => updateGoal(st, goal.id, { matrixWeights: { ...w, [c.key]: Number(e.target.value) } }))}
                className="w-full accent-emerald-600"
              />
            </label>
          ))}
        </div>
      </Card>

      {list.length > 0 && (
        <Card>
          <SectionTitle>比較（スコアは参考値。採用はあなたが決めます）</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="py-1 pr-2">戦略</th>
                  <th className="pr-2">期間</th>
                  <th className="pr-2">週h</th>
                  <th className="pr-2">費用</th>
                  {CRITERIA.map((c) => (
                    <th key={c.key} className="pr-1 font-normal" title={c.label}>{c.label.slice(0, 4)}</th>
                  ))}
                  <th className="pr-2">スコア</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ranked.map((x) => (
                  <tr key={x.id} className={`border-t border-zinc-100 align-top dark:border-zinc-800 ${x.selected ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}`}>
                    <td className="py-2 pr-2">
                      <div className="font-medium">{x.name}</div>
                      {x.selected && <Badge tone="emerald">採用中</Badge>}
                    </td>
                    <td className="pr-2">
                      <input type="number" className="w-14 rounded border border-zinc-300 bg-transparent px-1 dark:border-zinc-700" value={x.months ?? ""} onChange={(e) => dispatch((st) => updateStrategy(st, x.id, { months: e.target.value ? Number(e.target.value) : null }))} aria-label="期間（か月）" />
                    </td>
                    <td className="pr-2">
                      <input type="number" className="w-14 rounded border border-zinc-300 bg-transparent px-1 dark:border-zinc-700" value={x.hoursPerWeek ?? ""} onChange={(e) => dispatch((st) => updateStrategy(st, x.id, { hoursPerWeek: e.target.value ? Number(e.target.value) : null }))} aria-label="週あたり時間" />
                    </td>
                    <td className="pr-2">
                      <input type="number" className="w-20 rounded border border-zinc-300 bg-transparent px-1 dark:border-zinc-700" value={x.cost ?? ""} onChange={(e) => dispatch((st) => updateStrategy(st, x.id, { cost: e.target.value ? Number(e.target.value) : null }))} aria-label="費用" />
                    </td>
                    {CRITERIA.map((c) => (
                      <td key={c.key} className="pr-1">
                        <select
                          className="rounded border border-zinc-300 bg-transparent dark:border-zinc-700"
                          value={x.scores[c.key]}
                          onChange={(e) => dispatch((st) => updateStrategy(st, x.id, { scores: { ...x.scores, [c.key as CriterionKey]: Number(e.target.value) } }))}
                          aria-label={`${x.name}の${c.label}`}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td className="pr-2 font-semibold tabular-nums">{Math.round(strategyScore(x, w))}</td>
                    <td className="whitespace-nowrap">
                      {!x.selected && (
                        <Button variant="secondary" onClick={() => confirm(`「${x.name}」を採用しますか？（変更は履歴に残ります）`) && dispatch((st) => selectStrategy(st, x.id))}>
                          採用
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => confirm(`「${x.name}」を削除しますか？`) && dispatch((st) => deleteStrategy(st, x.id))}>
                        削除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3">
            {ranked.map((x) => (
              <details key={x.id} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
                <summary className="cursor-pointer text-sm font-medium">{x.name} のメリット・デメリット・リスク</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {(["pros", "cons", "risks"] as const).map((k) => (
                    <Field key={k} label={{ pros: "メリット", cons: "デメリット・機会費用", risks: "リスク・不確実性" }[k]}>
                      <textarea className={inputClass} rows={3} value={x[k]} onChange={(e) => dispatch((st) => updateStrategy(st, x.id, { [k]: e.target.value }))} />
                    </Field>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
