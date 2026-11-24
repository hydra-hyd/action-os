"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, Field, PageHeader, SectionTitle, Toast, inputClass, useNow } from "@/components/ui";
import {
  activeFocus,
  completeMinimum,
  completeTask,
  endFreeFocus,
  interruptTask,
  pauseFocus,
  rateLastFocus,
  resumeFocus,
  startFreeFocus,
  takeRest,
  updateTask,
} from "@/lib/domain/actions";
import type { AppState, FocusSession } from "@/lib/domain/types";
import { formatDuration } from "@/lib/domain/util";
import { useAppState, useHydrated } from "@/lib/store";

const INTERRUPT_REASONS = ["通知・連絡", "スマホを触った", "疲れた", "別の用事", "分からなくなった", "その他"];

function elapsedMs(f: FocusSession, now: Date) {
  const end = f.endedAt ? new Date(f.endedAt) : f.pausedAt ? new Date(f.pausedAt) : now;
  return Math.max(0, end.getTime() - new Date(f.startedAt).getTime() - f.pausedMs);
}

export default function FocusPage() {
  const [s, dispatch] = useAppState();
  const hydrated = useHydrated();
  const now = useNow(1000);
  const [interrupting, setInterrupting] = useState(false);
  const [reason, setReason] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [note, setNote] = useState("");
  const [justEnded, setJustEnded] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [freeMin, setFreeMin] = useState(25);

  if (!hydrated) return <div className="h-64" />;

  const f = activeFocus(s);
  const task = f?.taskId ? s.tasks.find((t) => t.id === f.taskId) : undefined;

  const finish = (fn: (st: AppState) => AppState, msg: string) => {
    const id = f?.id ?? null;
    dispatch(fn);
    setJustEnded(id);
    setToast(msg);
  };

  if (!f) {
    const last = justEnded ? s.focusSessions.find((x) => x.id === justEnded) : undefined;
    return (
      <div className="space-y-4">
        <PageHeader title="集中モード" />
        {last && last.immersion === null && (
          <Card>
            <SectionTitle>お疲れさまでした。どのくらい没頭できましたか？</SectionTitle>
            <p className="mb-3 text-sm text-zinc-500">集中時間 {formatDuration(elapsedMs(last, now))}（任意・スキップ可）</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button key={n} onClick={() => { dispatch((st) => rateLastFocus(st, last.id, n)); setJustEnded(null); }}>
                  {n}
                </Button>
              ))}
              <Button variant="ghost" onClick={() => setJustEnded(null)}>スキップ</Button>
            </div>
          </Card>
        )}
        <Card>
          <p className="text-sm text-zinc-500">実行中のタスクはありません。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/" className="inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white">ホームで次の一歩を選ぶ</Link>
            <Link href="/tasks" className="inline-flex min-h-10 items-center rounded-xl bg-zinc-100 px-4 text-sm dark:bg-zinc-800">タスク一覧</Link>
          </div>
        </Card>
        <Card>
          <SectionTitle>タスクなしでタイマーだけ使う</SectionTitle>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="分">
              <input type="number" min={1} max={180} className={`${inputClass} w-24`} value={freeMin} onChange={(e) => setFreeMin(Number(e.target.value) || 25)} />
            </Field>
            <Button onClick={() => dispatch((st) => startFreeFocus(st, "countdown", freeMin))}>カウントダウン</Button>
            <Button onClick={() => dispatch((st) => startFreeFocus(st, "pomodoro", 25))}>ポモドーロ（25分）</Button>
            <Button onClick={() => dispatch((st) => startFreeFocus(st, "countup", null))}>カウントアップ</Button>
          </div>
        </Card>
        <Toast message={toast} onDone={() => setToast(null)} />
      </div>
    );
  }

  const ms = elapsedMs(f, now);
  const target = f.targetMin ? f.targetMin * 60000 : null;
  const display = target ? Math.max(0, target - ms) : ms;
  const overTarget = target !== null && ms >= target;
  const paused = !!f.pausedAt;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge tone={paused ? "amber" : "emerald"}>{paused ? "一時停止中" : "集中中"}</Badge>
        <span className="text-xs text-zinc-500">{{ countup: "カウントアップ", countdown: "カウントダウン", pomodoro: "ポモドーロ" }[f.mode]}</span>
      </div>

      <Card className="text-center">
        {task ? (
          <>
            <h1 className="text-xl font-semibold">{task.title}</h1>
            <p className="mt-3 text-sm text-zinc-500">今やること</p>
            <p className="text-lg font-medium">{task.nextAction || task.firstAction || "必要なものを1つ手元に出す"}</p>
          </>
        ) : (
          <h1 className="text-xl font-semibold">フリータイマー</h1>
        )}
        <div className={`my-6 font-mono text-6xl font-semibold tabular-nums ${overTarget ? "text-emerald-600" : ""}`} aria-live="off">
          {formatClock(display)}
        </div>
        {overTarget && <p className="mb-3 text-sm text-emerald-700 dark:text-emerald-400">目標時間に到達しました。休憩してもOKです。</p>}
        <div className="flex flex-wrap justify-center gap-2">
          {paused ? (
            <Button variant="primary" onClick={() => dispatch((st) => resumeFocus(st))}>再開</Button>
          ) : (
            <Button onClick={() => dispatch((st) => pauseFocus(st))}>一時停止</Button>
          )}
          {!task && (
            <Button variant="primary" onClick={() => finish((st) => endFreeFocus(st), "記録しました")}>終了</Button>
          )}
        </div>
      </Card>

      {task && task.steps.length > 0 && (
        <Card>
          <SectionTitle>ステップ</SectionTitle>
          <ul className="space-y-1">
            {task.steps.map((st) => (
              <li key={st.id}>
                <label className="flex items-center gap-2 rounded-lg p-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    className="size-4 accent-emerald-600"
                    checked={st.done}
                    onChange={() =>
                      dispatch((s2) =>
                        updateTask(s2, task.id, { steps: task.steps.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)) }),
                      )
                    }
                  />
                  <span className={st.done ? "text-zinc-400 line-through" : ""}>{st.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {task && (
        <Card>
          <SectionTitle>終わり方を選ぶ（どれも正当な選択です）</SectionTitle>
          {task.goals.minimum && <p className="mb-2 text-sm text-zinc-500">最低目標：{task.goals.minimum}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="primary" onClick={() => finish((st) => completeTask(st, task.id), "完了！よくやりました")}>完了した</Button>
            <Button onClick={() => finish((st) => completeMinimum(st, task.id), "最低目標達成。着手できたことが実績です")}>最低目標まで達成</Button>
            <Button variant="warm" onClick={() => setInterrupting((v) => !v)}>中断する</Button>
            <Button variant="ghost" onClick={() => finish((st) => takeRest(st, task.id), "休息も大事な選択です")}>休む</Button>
          </div>
          {interrupting && (
            <div className="mt-3 grid gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
              <div className="flex flex-wrap gap-1">
                {INTERRUPT_REASONS.map((r) => (
                  <Button key={r} variant={reason === r ? "secondary" : "ghost"} onClick={() => setReason(r)}>{r}</Button>
                ))}
              </div>
              <Field label="次に再開したときの最初の行動（復帰モードで表示）">
                <input className={inputClass} value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="例：問題3から解く" />
              </Field>
              <Field label="ここまでの進捗メモ（任意）">
                <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Button
                variant="primary"
                onClick={() => {
                  finish((st) => interruptTask(st, task.id, reason, new Date(), { nextAction, note }), "中断を記録しました。戻ってきたら再開できます");
                  setInterrupting(false);
                  setReason("");
                  setNextAction("");
                  setNote("");
                }}
              >
                中断を記録
              </Button>
            </div>
          )}
        </Card>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function formatClock(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
