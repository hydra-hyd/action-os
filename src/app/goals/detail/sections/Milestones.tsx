"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, ProgressBar, SectionTitle, inputClass } from "@/components/ui";
import {
  addMetric,
  addMilestone,
  deleteMetric,
  deleteMilestone,
  logMetric,
  metricProgress,
  setGoalStatus,
  toDay,
  toggleMilestone,
  updateMilestone,
  MILESTONE_XP_MAX,
} from "@/lib/domain/goals";
import type { GoalMetric } from "@/lib/domain/types";
import { tryDispatch, type SectionProps } from "./types";

export function MilestonesSection({ s, dispatch, goal, now }: SectionProps) {
  const ms = s.milestones.filter((m) => m.goalId === goal.id).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.order - b.order);
  const metrics = s.metrics.filter((m) => m.goalId === goal.id);
  const today = toDay(now);
  const [error, setError] = useState("");
  const [mTitle, setMTitle] = useState("");
  const [mDue, setMDue] = useState("");
  const [mCriteria, setMCriteria] = useState("");
  const [mWeight, setMWeight] = useState(3);
  const [mXp, setMXp] = useState(100);

  const [k, setK] = useState<Omit<GoalMetric, "id" | "goalId" | "current">>({ name: "", kind: "lead", unit: "", start: 0, target: 10, frequency: "weekly", method: "" });
  const [logValues, setLogValues] = useState<Record<string, string>>({});
  const allDone = ms.length > 0 && ms.every((m) => m.done);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>マイルストーン（チャプター／ボス戦）</SectionTitle>
        {ms.length === 0 ? (
          <p className="text-sm text-zinc-500">まだありません。下で追加するか、「逆算計画」タブで期限から自動で案を作れます。</p>
        ) : (
          <ul className="space-y-2">
            {ms.map((m, i) => {
              const late = !m.done && m.dueDate && m.dueDate < today;
              const linked = s.tasks.filter((t) => t.milestoneId === m.id);
              const blockedBy = m.dependsOn.map((id) => s.milestones.find((x) => x.id === id)).filter((x) => x && !x.done);
              return (
                <li key={m.id} className={`rounded-xl border p-3 ${late ? "border-rose-300 dark:border-rose-800" : "border-zinc-200 dark:border-zinc-800"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-5 accent-emerald-600"
                      checked={m.done}
                      onChange={() => dispatch((st) => toggleMilestone(st, m.id))}
                      aria-label={`${m.title}を達成済みにする`}
                    />
                    <span className="text-xs text-zinc-400">第{i + 1}章</span>
                    <input
                      className={`${inputClass} min-w-40 flex-1 ${m.done ? "line-through opacity-60" : ""}`}
                      value={m.title}
                      onChange={(e) => dispatch((st) => updateMilestone(st, m.id, { title: e.target.value }))}
                    />
                    <input
                      type="date"
                      className={`${inputClass} w-40`}
                      value={m.dueDate ?? ""}
                      onChange={(e) => dispatch((st) => updateMilestone(st, m.id, { dueDate: e.target.value || null }))}
                      aria-label="達成予定日"
                    />
                    <select className={`${inputClass} w-24`} value={m.weight} onChange={(e) => dispatch((st) => updateMilestone(st, m.id, { weight: Number(e.target.value) }))} aria-label="重要度">
                      {[1, 2, 3, 4, 5].map((w) => (
                        <option key={w} value={w}>重要度{w}</option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`「${m.title}」を削除しますか？紐づくタスクは残ります。`)) dispatch((st) => deleteMilestone(st, m.id));
                      }}
                    >
                      削除
                    </Button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 pl-7 text-xs text-zinc-500">
                    {late && <Badge tone="rose">期限超過</Badge>}
                    {m.done && m.doneAt && <Badge tone="emerald">達成 {m.doneAt.slice(0, 10)}</Badge>}
                    {blockedBy.length > 0 && <Badge tone="amber">先行：{blockedBy.map((x) => x!.title).join("、")}</Badge>}
                    {m.criteria && <span>条件：{m.criteria}</span>}
                    <span>タスク {linked.filter((t) => t.status === "done").length}/{linked.length}</span>
                    {s.settings.gamification && <span>{Math.min(m.xp, MILESTONE_XP_MAX)} XP</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {allDone && goal.status !== "achieved" && (
          <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm dark:bg-emerald-900/30">
            すべてのマイルストーンを達成しました。達成条件を満たしていれば、目標を「達成」にしましょう。
            <Button variant="primary" className="ml-2" onClick={() => dispatch((st) => setGoalStatus(st, goal.id, "achieved"))}>
              目標を達成にする
            </Button>
          </div>
        )}
        <div className="mt-4 grid gap-2 rounded-xl bg-zinc-50 p-3 sm:grid-cols-6 dark:bg-zinc-800/50">
          <div className="sm:col-span-2">
            <Field label="マイルストーン名">
              <input className={inputClass} value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="例：模擬試験で6割" />
            </Field>
          </div>
          <Field label="達成予定日">
            <input type="date" className={inputClass} value={mDue} onChange={(e) => setMDue(e.target.value)} />
          </Field>
          <Field label="重要度">
            <select className={inputClass} value={mWeight} onChange={(e) => setMWeight(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </Field>
          <Field label={`XP（最大${MILESTONE_XP_MAX}）`}>
            <input type="number" min={0} max={MILESTONE_XP_MAX} className={inputClass} value={mXp} onChange={(e) => setMXp(Number(e.target.value))} />
          </Field>
          <div className="sm:col-span-6">
            <Field label="達成条件・成果物">
              <input className={inputClass} value={mCriteria} onChange={(e) => setMCriteria(e.target.value)} />
            </Field>
          </div>
          <div>
            <Button
              variant="primary"
              onClick={() => {
                if (tryDispatch(dispatch, (st) => addMilestone(st, goal.id, { title: mTitle, dueDate: mDue || null, criteria: mCriteria, weight: mWeight, xp: mXp }), setError)) {
                  setMTitle("");
                  setMDue("");
                  setMCriteria("");
                }
              }}
            >
              追加
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>KPI（先行指標・結果指標）</SectionTitle>
        <p className="mb-3 text-xs text-zinc-500">結果指標（合格・点数・資産額など）は目標の進捗に使います。先行指標（学習時間・問題数など）は毎日コントロールできる行動の進み具合です。</p>
        {metrics.length === 0 ? (
          <p className="text-sm text-zinc-500">まだありません。</p>
        ) : (
          <ul className="space-y-3">
            {metrics.map((m) => {
              const logs = s.metricLogs.filter((l) => l.metricId === m.id);
              return (
                <li key={m.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={m.kind === "lag" ? "sky" : "emerald"}>{m.kind === "lag" ? "結果指標" : "先行指標"}</Badge>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-sm tabular-nums text-zinc-500">
                      {m.current}
                      {m.unit} / 目標 {m.target}
                      {m.unit}（開始 {m.start}）
                    </span>
                    <span className="ml-auto text-xs text-zinc-500">
                      {{ daily: "毎日", weekly: "毎週", monthly: "毎月", once: "1回" }[m.frequency]}測定{m.method && `・${m.method}`}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={metricProgress(m) * 100} max={100} />
                  </div>
                  <form
                    className="mt-2 flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = Number(logValues[m.id]);
                      if (logValues[m.id] === undefined || logValues[m.id] === "" || !Number.isFinite(v)) return;
                      dispatch((st) => logMetric(st, m.id, v));
                      setLogValues({ ...logValues, [m.id]: "" });
                    }}
                  >
                    <input
                      type="number"
                      step="any"
                      className={`${inputClass} w-32`}
                      value={logValues[m.id] ?? ""}
                      onChange={(e) => setLogValues({ ...logValues, [m.id]: e.target.value })}
                      placeholder="現在値"
                      aria-label={`${m.name}の現在値`}
                    />
                    <Button type="submit">測定値を記録</Button>
                    <span className="text-xs text-zinc-500">記録 {logs.length}件{logs.length > 0 && `（最終 ${logs[logs.length - 1].at.slice(0, 10)}）`}</span>
                    <Button
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => {
                        if (confirm(`指標「${m.name}」と測定履歴を削除しますか？`)) dispatch((st) => deleteMetric(st, m.id));
                      }}
                    >
                      削除
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 grid gap-2 rounded-xl bg-zinc-50 p-3 sm:grid-cols-4 dark:bg-zinc-800/50">
          <Field label="指標名">
            <input className={inputClass} value={k.name} onChange={(e) => setK({ ...k, name: e.target.value })} placeholder="例：週間学習時間" />
          </Field>
          <Field label="種類">
            <select className={inputClass} value={k.kind} onChange={(e) => setK({ ...k, kind: e.target.value as GoalMetric["kind"] })}>
              <option value="lead">先行指標（行動）</option>
              <option value="lag">結果指標（成果）</option>
            </select>
          </Field>
          <Field label="単位">
            <input className={inputClass} value={k.unit} onChange={(e) => setK({ ...k, unit: e.target.value })} placeholder="時間・問・点・円" />
          </Field>
          <Field label="測定頻度">
            <select className={inputClass} value={k.frequency} onChange={(e) => setK({ ...k, frequency: e.target.value as GoalMetric["frequency"] })}>
              <option value="daily">毎日</option>
              <option value="weekly">毎週</option>
              <option value="monthly">毎月</option>
              <option value="once">1回</option>
            </select>
          </Field>
          <Field label="開始値">
            <input type="number" step="any" className={inputClass} value={k.start} onChange={(e) => setK({ ...k, start: Number(e.target.value) })} />
          </Field>
          <Field label="目標値">
            <input type="number" step="any" className={inputClass} value={k.target} onChange={(e) => setK({ ...k, target: Number(e.target.value) })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="測定方法">
              <input className={inputClass} value={k.method} onChange={(e) => setK({ ...k, method: e.target.value })} />
            </Field>
          </div>
          <div>
            <Button
              variant="primary"
              onClick={() => {
                if (tryDispatch(dispatch, (st) => addMetric(st, goal.id, k), setError)) setK({ ...k, name: "" });
              }}
            >
              指標を追加
            </Button>
          </div>
        </div>
      </Card>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
