"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, Button, Card, Field, PageHeader, Toast, inputClass } from "@/components/ui";
import { AI_ERROR_LABEL, decomposeTask } from "@/lib/ai";
import {
  addTask,
  cancelTask,
  deleteTask,
  duplicateTask,
  postponeTask,
  startTask,
  updateTask,
  type TaskInput,
} from "@/lib/domain/actions";
import { priorityScore } from "@/lib/domain/priority";
import { TASK_STATUS_LABEL, type Task, type TaskStatus } from "@/lib/domain/types";
import { uid } from "@/lib/domain/util";
import { useAppState, useHydrated } from "@/lib/store";

type Draft = Omit<TaskInput, "steps"> & { steps: Task["steps"] };

const blank = (): Draft => ({
  title: "",
  description: "",
  category: "",
  importance: 50,
  urgency: 50,
  valueAlignment: 50,
  longTermImpact: 50,
  feasibility: 50,
  psychLoad: 30,
  deadline: null,
  plannedStart: null,
  estimateMin: null,
  firstAction: "",
  goals: { minimum: "", normal: "", stretch: "" },
  steps: [],
  goalId: null,
  milestoneId: null,
  isMostImportant: false,
});

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const FILTERS: { key: string; label: string; match: (t: Task) => boolean }[] = [
  { key: "active", label: "進行中", match: (t) => !["done", "cancelled"].includes(t.status) },
  { key: "done", label: "完了", match: (t) => t.status === "done" || t.status === "minimum_done" },
  { key: "cancelled", label: "キャンセル", match: (t) => t.status === "cancelled" },
  { key: "all", label: "すべて", match: () => true },
];

export default function TasksPage() {
  const [s, dispatch] = useAppState();
  const hydrated = useHydrated();
  const router = useRouter();
  const [filter, setFilter] = useState("active");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [decompSource, setDecompSource] = useState<string | null>(null);

  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    return s.tasks
      .filter(f.match)
      .filter((t) => !q || `${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => priorityScore(b, s.settings.weights) - priorityScore(a, s.settings.weights));
  }, [s.tasks, s.settings.weights, filter, q]);

  if (!hydrated) return <div className="h-64" />;

  const openNew = () => {
    setDraft(blank());
    setEditing("new");
    setDecompSource(null);
  };
  const openEdit = (t: Task) => {
    setDraft({ ...t });
    setEditing(t.id);
    setDecompSource(null);
  };

  const save = () => {
    if (!draft.title.trim()) {
      setToast("タスク名を入力してください");
      return;
    }
    if (editing === "new") dispatch((st) => addTask(st, draft));
    else if (editing) dispatch((st) => updateTask(st, editing, draft as Partial<Task>));
    setEditing(null);
    setToast("保存しました");
  };

  const runDecompose = async () => {
    if (!draft.title.trim()) {
      setToast("先にタスク名を入力してください");
      return;
    }
    setBusy(true);
    const r = await decomposeTask(draft.title, draft.description ?? "", s.settings.aiEnabled);
    setBusy(false);
    setDraft((d) => ({
      ...d,
      firstAction: r.firstAction,
      goals: r.goals,
      steps: r.steps.map((text) => ({ id: uid(), text, done: false })),
    }));
    setDecompSource(
      r.source === "ai"
        ? "AIが分解しました。内容を確認・修正してください。"
        : `ルールベースで分解しました（AIではありません）。${r.aiError ? AI_ERROR_LABEL[r.aiError] ?? r.aiError : s.settings.aiEnabled ? "" : "AI送信は設定でオフになっています。"}`,
    );
  };

  const num = (k: keyof Draft, label: string, hint?: string) => (
    <Field label={`${label}：${draft[k] as number}`} hint={hint}>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={draft[k] as number}
        onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
        className="w-full accent-emerald-600"
      />
    </Field>
  );

  return (
    <div>
      <PageHeader title="タスク" sub="優先度スコア順に並びます。心理的負担が大きいタスクは、優先度を下げずに分解を提案します。" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={openNew}>＋ 新しいタスク</Button>
        <input className={`${inputClass} max-w-60`} placeholder="検索" value={q} onChange={(e) => setQ(e.target.value)} aria-label="タスク検索" />
        <div className="flex gap-1" role="tablist">
          {FILTERS.map((f) => (
            <Button key={f.key} variant={filter === f.key ? "secondary" : "ghost"} onClick={() => setFilter(f.key)} role="tab" aria-selected={filter === f.key}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {editing && (
        <Card className="mb-4">
          <div className="grid gap-3">
            <Field label="タスク名（必須）">
              <input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
            </Field>
            <Field label="詳細">
              <textarea className={inputClass} rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={runDecompose} disabled={busy}>
                {busy ? "分解中…" : "✦ 具体的な行動に分解する"}
              </Button>
              {decompSource && <span className="text-xs text-zinc-500">{decompSource}</span>}
            </div>
            <Field label="最初の30秒アクション" hint="例：テキストを開く／IDEを起動する">
              <input className={inputClass} value={draft.firstAction} onChange={(e) => setDraft({ ...draft, firstAction: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["minimum", "normal", "stretch"] as const).map((k) => (
                <Field key={k} label={{ minimum: "最低目標", normal: "通常目標", stretch: "発展目標" }[k]}>
                  <input className={inputClass} value={draft.goals?.[k] ?? ""} onChange={(e) => setDraft({ ...draft, goals: { ...draft.goals!, [k]: e.target.value } })} />
                </Field>
              ))}
            </div>
            <div>
              <div className="mb-1 text-sm font-medium">ステップ</div>
              <ol className="space-y-1">
                {draft.steps.map((st, i) => (
                  <li key={st.id} className="flex gap-2">
                    <span className="w-5 pt-2 text-right text-xs text-zinc-400">{i + 1}</span>
                    <input
                      className={inputClass}
                      value={st.text}
                      onChange={(e) => setDraft({ ...draft, steps: draft.steps.map((x) => (x.id === st.id ? { ...x, text: e.target.value } : x)) })}
                    />
                    <Button variant="ghost" aria-label="ステップを削除" onClick={() => setDraft({ ...draft, steps: draft.steps.filter((x) => x.id !== st.id) })}>✕</Button>
                  </li>
                ))}
              </ol>
              <Button variant="ghost" className="mt-1" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { id: uid(), text: "", done: false }] })}>＋ ステップ</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="行動予定時刻">
                <input type="datetime-local" className={inputClass} value={toLocalInput(draft.plannedStart)} onChange={(e) => setDraft({ ...draft, plannedStart: fromLocalInput(e.target.value) })} />
              </Field>
              <Field label="締切">
                <input type="datetime-local" className={inputClass} value={toLocalInput(draft.deadline)} onChange={(e) => setDraft({ ...draft, deadline: fromLocalInput(e.target.value) })} />
              </Field>
              <Field label="推定所要時間（分）">
                <input type="number" min={1} className={inputClass} value={draft.estimateMin ?? ""} onChange={(e) => setDraft({ ...draft, estimateMin: e.target.value ? Number(e.target.value) : null })} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="カテゴリー">
                <input className={inputClass} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="学業・健康・キャリアなど" />
              </Field>
              <Field label="関連する目標">
                <select className={inputClass} value={draft.goalId ?? ""} onChange={(e) => setDraft({ ...draft, goalId: e.target.value || null, milestoneId: null })}>
                  <option value="">なし</option>
                  {s.goals.filter((g) => g.status !== "withdrawn").map((g) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </Field>
              <Field label="マイルストーン">
                <select className={inputClass} value={draft.milestoneId ?? ""} onChange={(e) => setDraft({ ...draft, milestoneId: e.target.value || null })} disabled={!draft.goalId}>
                  <option value="">なし</option>
                  {s.milestones.filter((m) => m.goalId === draft.goalId).map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </Field>
            </div>
            <details className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
              <summary className="cursor-pointer text-sm font-medium">優先度の評価（0〜100）</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {num("importance", "重要度")}
                {num("urgency", "緊急度")}
                {num("valueAlignment", "価値観との一致度")}
                {num("longTermImpact", "長期的影響")}
                {num("feasibility", "実行可能性")}
                {num("psychLoad", "心理的負担", "高くても優先度は下がりません。分解を提案します")}
              </div>
            </details>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!draft.isMostImportant} onChange={(e) => setDraft({ ...draft, isMostImportant: e.target.checked })} className="size-4 accent-emerald-600" />
              本日の最重要タスクにする（1つだけ）
            </label>
            <div className="flex gap-2">
              <Button variant="primary" onClick={save}>保存</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>やめる</Button>
            </div>
          </div>
        </Card>
      )}

      {list.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">該当するタスクはありません。</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {list.map((t) => (
            <li key={t.id}>
              <TaskRow
                t={t}
                score={Math.round(priorityScore(t, s.settings.weights))}
                goalTitle={t.goalId ? s.goals.find((g) => g.id === t.goalId)?.title : undefined}
                onStart={() => {
                  dispatch((st) => startTask(st, t.id));
                  router.push("/focus");
                }}
                onEdit={() => openEdit(t)}
                onDuplicate={() => dispatch((st) => duplicateTask(st, t.id))}
                onPostpone={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  tomorrow.setHours(9, 0, 0, 0);
                  dispatch((st) => postponeTask(st, t.id, tomorrow.toISOString()));
                  setToast("明日9時に延期しました");
                }}
                onCancel={() => dispatch((st) => cancelTask(st, t.id))}
                onDelete={() => {
                  if (confirm(`「${t.title}」を削除しますか？行動記録は残ります。`)) dispatch((st) => deleteTask(st, t.id));
                }}
                onStuck={() => router.push(`/stuck?task=${t.id}`)}
              />
            </li>
          ))}
        </ul>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function TaskRow(props: {
  t: Task;
  score: number;
  goalTitle?: string;
  onStart: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onPostpone: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onStuck: () => void;
}) {
  const { t } = props;
  const tone: Record<TaskStatus, "zinc" | "emerald" | "amber" | "sky" | "rose"> = {
    todo: "zinc",
    doing: "emerald",
    paused: "amber",
    interrupted: "amber",
    minimum_done: "sky",
    done: "emerald",
    postponed: "zinc",
    replan: "amber",
    cancelled: "rose",
  };
  const closed = t.status === "done" || t.status === "cancelled";
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{t.title}</span>
            <Badge tone={tone[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge>
            {t.isMostImportant && <Badge tone="emerald">最重要</Badge>}
            {t.psychLoad >= 70 && t.steps.length === 0 && <Badge tone="amber">分解がおすすめ</Badge>}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            優先度 {props.score}
            {props.goalTitle && ` ・ ◎ ${props.goalTitle}`}
            {t.firstAction && ` ・ 最初の行動：${t.firstAction}`}
            {t.deadline && ` ・ 締切 ${new Date(t.deadline).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
          </div>
        </div>
        {!closed && (
          <Button variant="primary" onClick={props.onStart} aria-label={`${t.title}を開始`}>
            ▶ 開始
          </Button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button variant="ghost" onClick={props.onEdit}>編集</Button>
        {!closed && <Button variant="ghost" onClick={props.onStuck}>気が進まない</Button>}
        {!closed && <Button variant="ghost" onClick={props.onPostpone}>明日に延期</Button>}
        <Button variant="ghost" onClick={props.onDuplicate}>複製</Button>
        {!closed && <Button variant="ghost" onClick={props.onCancel}>撤回</Button>}
        <Button variant="ghost" onClick={props.onDelete}>削除</Button>
      </div>
    </Card>
  );
}
