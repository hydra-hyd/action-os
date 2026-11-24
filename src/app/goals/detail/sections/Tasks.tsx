"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, Field, SectionTitle, inputClass } from "@/components/ui";
import { addTask, startTask, updateTask } from "@/lib/domain/actions";
import { ruleBasedDecompose } from "@/lib/domain/decompose";
import { actualHoursByGoal, descendantIds } from "@/lib/domain/goals";
import { TASK_STATUS_LABEL } from "@/lib/domain/types";
import { tryDispatch, type SectionProps } from "./types";

export function TasksSection({ s, dispatch, goal, now }: SectionProps) {
  const router = useRouter();
  const ids = new Set(descendantIds(s, goal.id));
  const tasks = s.tasks.filter((t) => t.goalId && ids.has(t.goalId));
  const open = tasks.filter((t) => !["done", "cancelled"].includes(t.status)).sort((a, b) => (a.plannedStart ?? "9").localeCompare(b.plannedStart ?? "9"));
  const closed = tasks.filter((t) => ["done", "cancelled"].includes(t.status));
  const unlinked = s.tasks.filter((t) => !t.goalId && !["done", "cancelled"].includes(t.status));
  const ms = s.milestones.filter((m) => m.goalId === goal.id && !m.done);
  const [title, setTitle] = useState("");
  const [msId, setMsId] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const hours = actualHoursByGoal(s, new Date(0), new Date(8640000000000000), now).get(goal.id) ?? 0;

  const add = () => {
    const d = ruleBasedDecompose(title);
    const plannedStart = date ? new Date(`${date}T19:00:00`).toISOString() : null;
    if (tryDispatch(dispatch, (st) => addTask(st, { title, goalId: goal.id, milestoneId: msId || null, firstAction: d.firstAction, goals: d.goals, plannedStart }), setError)) {
      setTitle("");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>この目標の次の行動</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-[1fr_12rem_10rem_auto]">
          <Field label="タスク名">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：過去問を1年分解く" />
          </Field>
          <Field label="マイルストーン">
            <select className={inputClass} value={msId} onChange={(e) => setMsId(e.target.value)}>
              <option value="">なし</option>
              {ms.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          </Field>
          <Field label="行動予定日">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button variant="primary" onClick={add}>追加</Button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <p className="mt-2 text-xs text-zinc-500">最初の30秒アクションと最低目標は自動で入ります。タスク画面で編集できます。累計の集中時間：{hours.toFixed(1)}時間</p>
      </Card>

      <Card>
        <SectionTitle>未完了のタスク（子目標を含む）</SectionTitle>
        {open.length === 0 ? (
          <p className="text-sm text-zinc-500">ありません。</p>
        ) : (
          <ul className="space-y-2">
            {open.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-zinc-50 p-2 dark:bg-zinc-800/50">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.title}</div>
                  <div className="text-xs text-zinc-500">
                    <Badge>{TASK_STATUS_LABEL[t.status]}</Badge> {t.plannedStart && new Date(t.plannedStart).toLocaleDateString("ja-JP")}
                    {t.milestoneId && ` ・ ${s.milestones.find((m) => m.id === t.milestoneId)?.title ?? ""}`}
                    {t.goalId !== goal.id && ` ・ ${s.goals.find((g) => g.id === t.goalId)?.title}`}
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => {
                    dispatch((st) => startTask(st, t.id));
                    router.push("/focus");
                  }}
                >
                  ▶ 開始
                </Button>
                <Button variant="ghost" onClick={() => router.push(`/stuck?task=${t.id}`)}>気が進まない</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {unlinked.length > 0 && (
        <Card>
          <SectionTitle>既存のタスクをこの目標に紐付ける</SectionTitle>
          <select
            className={inputClass}
            value=""
            onChange={(e) => e.target.value && dispatch((st) => updateTask(st, e.target.value, { goalId: goal.id }))}
            aria-label="紐付けるタスク"
          >
            <option value="">タスクを選択…</option>
            {unlinked.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </Card>
      )}

      {closed.length > 0 && (
        <Card>
          <SectionTitle>完了・キャンセル（{closed.length}件）</SectionTitle>
          <ul className="space-y-1 text-sm text-zinc-500">
            {closed.slice(-20).map((t) => (
              <li key={t.id}>
                {t.status === "done" ? "✓" : "–"} {t.title}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
