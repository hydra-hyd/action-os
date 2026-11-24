"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, SectionTitle, inputClass } from "@/components/ui";
import { DEFAULT_PHASES, PHASE_TEMPLATES, addDays, applyPlanDraft, generateBackwardPlan, toDay, type PlanDraft } from "@/lib/domain/goals";
import type { SectionProps } from "./types";

export function PlanSection({ s, dispatch, goal, now, goTab }: SectionProps) {
  const today = toDay(now);
  const [start, setStart] = useState(goal.startDate && goal.startDate > today ? goal.startDate : today);
  const [due, setDue] = useState(goal.dueDate ?? addDays(today, 180));
  const [phases, setPhases] = useState((PHASE_TEMPLATES[goal.category] ?? DEFAULT_PHASES).join("\n"));
  const [weeklyHours, setWeeklyHours] = useState(goal.weeklyHours ?? 7);
  const [totalHours, setTotalHours] = useState("");
  const [restDays, setRestDays] = useState(1);
  const [buffer, setBuffer] = useState(0.15);
  const [nearWeeks, setNearWeeks] = useState(2);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [include, setInclude] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState("");

  const generate = () => {
    const d = generateBackwardPlan({
      startDate: start,
      dueDate: due,
      phases: phases.split("\n"),
      weeklyHours,
      totalHours: totalHours ? Number(totalHours) : null,
      restDaysPerWeek: restDays,
      bufferRatio: buffer,
      nearTermWeeks: nearWeeks,
    });
    setDraft(d);
    setInclude(Object.fromEntries(d.tasks.map((t) => [t.key, true])));
    setDone("");
  };

  const approve = () => {
    if (!draft) return;
    const final: PlanDraft = { ...draft, tasks: draft.tasks.filter((t) => include[t.key]) };
    if (!confirm(`マイルストーン${final.milestones.length}件とタスク${final.tasks.length}件を登録します。現在の計画は変更履歴に保存されます。よろしいですか？`)) return;
    dispatch((st) => applyPlanDraft(st, goal.id, final, { setDueDate: goal.dueDate ? undefined : due, setWeeklyHours: weeklyHours }));
    setDraft(null);
    setDone(`マイルストーン${final.milestones.length}件・タスク${final.tasks.length}件を登録しました。`);
  };

  const existingMs = s.milestones.filter((m) => m.goalId === goal.id).length;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>期限からの逆算計画</SectionTitle>
        <p className="mb-3 text-xs text-zinc-500">
          <Badge>ルールベース（AI未接続）</Badge> 入力した条件から機械的に案を作ります。直近 {nearWeeks} 週だけ具体的なタスクにし、先の期間はマイルストーン（概要）に留めます（ローリングウェーブ）。
          試験日程・制度などの外部情報は推測せず、公式情報で確認した日付を入力してください。
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="開始日">
            <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="期限（達成予定日）" hint={goal.dueDate ? "目標の期限" : "承認時に目標の期限として設定"}>
            <input type="date" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} disabled={!!goal.dueDate} />
          </Field>
          <Field label="週に使える時間（h）">
            <input type="number" min={0.5} step={0.5} className={inputClass} value={weeklyHours} onChange={(e) => setWeeklyHours(Number(e.target.value) || 0)} />
          </Field>
          <Field label="必要な総作業量（h・任意）" hint="分かる場合のみ。超過を警告します">
            <input type="number" min={0} className={inputClass} value={totalHours} onChange={(e) => setTotalHours(e.target.value)} />
          </Field>
          <Field label="週の休息日">
            <select className={inputClass} value={restDays} onChange={(e) => setRestDays(Number(e.target.value))}>
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>{n}日</option>
              ))}
            </select>
          </Field>
          <Field label="予備期間">
            <select className={inputClass} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))}>
              {[0, 0.1, 0.15, 0.2, 0.3].map((n) => (
                <option key={n} value={n}>{Math.round(n * 100)}%</option>
              ))}
            </select>
          </Field>
          <Field label="詳細タスクを作る期間">
            <select className={inputClass} value={nearWeeks} onChange={(e) => setNearWeeks(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>直近{n}週</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-4">
            <Field label="フェーズ（1行に1つ。順番に進めます）" hint={PHASE_TEMPLATES[goal.category] ? `カテゴリー「${goal.category}」のひな形を入れています` : "一般的なひな形を入れています。自由に書き換えてください"}>
              <textarea className={inputClass} rows={6} value={phases} onChange={(e) => setPhases(e.target.value)} />
            </Field>
          </div>
        </div>
        <Button variant="primary" className="mt-3" onClick={generate}>計画案を作る</Button>
        {existingMs > 0 && <p className="mt-2 text-xs text-zinc-500">既存のマイルストーン{existingMs}件は削除されず、案が追加されます。</p>}
        {done && (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
            {done}
            <button type="button" className="ml-2 underline" onClick={() => goTab("tasks")}>タスクを見る</button>
          </p>
        )}
      </Card>

      {draft && (
        <Card className="border-emerald-200 dark:border-emerald-900">
          <SectionTitle>計画案（まだ登録されていません）</SectionTitle>
          <p className="text-sm text-zinc-500">
            期間 約{draft.weeks}週 ・ 利用可能時間 約{draft.availableHours}時間 ・ 計画作業量 約{draft.totalHours}時間
          </p>
          {draft.warnings.map((w) => (
            <p key={w} className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">⚠ {w}</p>
          ))}
          {draft.milestones.length > 0 && (
            <>
              <h3 className="mt-4 mb-2 text-sm font-semibold">マイルストーン（編集できます）</h3>
              <ul className="space-y-2">
                {draft.milestones.map((m, i) => (
                  <li key={m.key} className="grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
                    <input
                      className={inputClass}
                      value={m.title}
                      onChange={(e) => setDraft({ ...draft, milestones: draft.milestones.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })}
                      aria-label="マイルストーン名"
                    />
                    <input type="date" className={inputClass} value={m.startDate} onChange={(e) => setDraft({ ...draft, milestones: draft.milestones.map((x, j) => (j === i ? { ...x, startDate: e.target.value } : x)) })} aria-label="開始日" />
                    <input type="date" className={inputClass} value={m.dueDate} onChange={(e) => setDraft({ ...draft, milestones: draft.milestones.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)) })} aria-label="期限" />
                  </li>
                ))}
              </ul>
              <h3 className="mt-4 mb-2 text-sm font-semibold">直近のタスク（チェックしたものだけ登録）</h3>
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {draft.tasks.map((t) => (
                  <li key={t.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-emerald-600" checked={!!include[t.key]} onChange={(e) => setInclude({ ...include, [t.key]: e.target.checked })} aria-label={`${t.title}を登録する`} />
                    <span className="w-24 shrink-0 tabular-nums text-zinc-500">{t.plannedStart}</span>
                    <input
                      className={inputClass}
                      value={t.title}
                      onChange={(e) => setDraft({ ...draft, tasks: draft.tasks.map((x) => (x.key === t.key ? { ...x, title: e.target.value } : x)) })}
                    />
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Button variant="primary" onClick={approve}>承認して登録</Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>破棄</Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
