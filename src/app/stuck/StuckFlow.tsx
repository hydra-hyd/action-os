"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, Field, PageHeader, SectionTitle, inputClass } from "@/components/ui";
import { logIntervention, postponeTask, replanTask, startTask, takeRest } from "@/lib/domain/actions";
import { rankTasks } from "@/lib/domain/priority";
import { BLOCKER_LABEL, defuse, recommendTechniques, type Technique } from "@/lib/domain/techniques";
import type { Blocker, InterventionLog } from "@/lib/domain/types";
import { useAppState, useHydrated } from "@/lib/store";

const BLOCKERS = Object.keys(BLOCKER_LABEL) as Blocker[];

export function StuckFlow() {
  const [s, dispatch] = useAppState();
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [techIdx, setTechIdx] = useState(0);
  const [thought, setThought] = useState("");
  const [note, setNote] = useState("");

  if (!hydrated) return <div className="h-64" />;

  const paramTask = params.get("task");
  const task = s.tasks.find((t) => t.id === paramTask) ?? rankTasks(s.tasks, s.settings.weights)[0];
  const techniques = blocker ? recommendTechniques(blocker) : [];
  const tech: Technique | undefined = techniques[techIdx];

  const record = (outcome: InterventionLog["outcome"]) => {
    if (!blocker || !tech) return;
    dispatch((st) =>
      logIntervention(st, { taskId: task?.id ?? null, blocker, techniqueId: tech.id, note: note || thought, outcome }),
    );
  };

  const choose = (outcome: InterventionLog["outcome"]) => {
    record(outcome);
    if (!task) {
      router.push("/");
      return;
    }
    if (outcome === "started" || outcome === "minimum") {
      dispatch((st) =>
        startTask(st, task.id, new Date(), outcome === "started" ? { mode: "countdown", targetMin: 0.5 } : {}),
      );
      router.push("/focus");
    } else if (outcome === "rest") {
      dispatch((st) => takeRest(st, task.id));
      router.push("/");
    } else if (outcome === "postpone") {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      t.setHours(9, 0, 0, 0);
      dispatch((st) => postponeTask(st, task.id, t.toISOString()));
      router.push("/");
    } else if (outcome === "replan") {
      dispatch((st) => replanTask(st, task.id));
      router.push("/tasks");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="行動できない・気が進まない" sub="行動できないのは意志が弱いからではありません。原因に合った小さな方法を一緒に選びます。" />

      {task && (
        <Card>
          <div className="text-xs text-zinc-500">対象のタスク</div>
          <div className="font-medium">{task.title}</div>
          {task.firstAction && <div className="text-sm text-zinc-500">最初の行動：{task.firstAction}</div>}
        </Card>
      )}

      <Card>
        <SectionTitle>いちばん近いものは？</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {BLOCKERS.map((b) => (
            <Button
              key={b}
              variant={blocker === b ? "primary" : "secondary"}
              onClick={() => {
                setBlocker(b);
                setTechIdx(0);
              }}
              aria-pressed={blocker === b}
            >
              {BLOCKER_LABEL[b]}
            </Button>
          ))}
        </div>
        {blocker === "other" && (
          <div className="mt-3">
            <Field label="自由入力（任意）">
              <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        )}
      </Card>

      {tech && (
        <Card>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{tech.name}</h2>
            <Badge>{tech.category}</Badge>
            <Badge tone="sky">約{tech.minutes}分</Badge>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {tech.steps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>

          {tech.id === "defusion" && (
            <div className="mt-3 space-y-2">
              <Field label="今浮かんでいる考え">
                <input className={inputClass} value={thought} onChange={(e) => setThought(e.target.value)} placeholder="例：自分にはできない" />
              </Field>
              {thought.trim() && (
                <p className="rounded-xl bg-sky-50 p-3 text-sm dark:bg-sky-900/30">
                  {defuse(thought)}
                  <br />
                  <span className="text-zinc-500">この考えがあっても、最初の30秒の行動はできるかもしれません。</span>
                </p>
              )}
            </div>
          )}

          {tech.caution && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">※ {tech.caution}</p>}

          <p className="mt-3 text-xs text-zinc-500">
            出典：
            {tech.source.url ? (
              <a href={tech.source.url} target="_blank" rel="noreferrer" className="underline">
                {tech.source.title}
              </a>
            ) : (
              tech.source.title
            )}
            {tech.sourceStatus === "notion_unsynced"
              ? "（Notion本文は未同期。手順は要件定義書の記述に基づく一般的な内容です）"
              : "（Notion資料との照合なし）"}
          </p>

          {techniques.length > 1 && (
            <Button variant="ghost" className="mt-2" onClick={() => setTechIdx((i) => (i + 1) % techniques.length)}>
              別の方法を見る（{techIdx + 1}/{techniques.length}）
            </Button>
          )}
        </Card>
      )}

      {tech && (
        <Card>
          <SectionTitle>次にどうする？</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="primary" className="min-h-12" onClick={() => choose("started")} disabled={!task}>
              30秒だけやってみる
            </Button>
            <Button onClick={() => choose("minimum")} disabled={!task}>
              最低目標に切り替えて始める
            </Button>
            <Button variant="ghost" onClick={() => choose("rest")}>今は休む</Button>
            <Button variant="ghost" onClick={() => choose("postpone")} disabled={!task}>明日に延期</Button>
            <Button variant="ghost" onClick={() => choose("replan")} disabled={!task}>計画を見直す</Button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">休む・延期・見直しも正当な選択です。過去の実績は消えません。</p>
        </Card>
      )}

      <p className="text-xs text-zinc-400">
        このアプリは医療的な診断や治療を行いません。気分の落ち込みや強い不安が続く場合は、医師やカウンセラーなどの専門家に相談してください。
      </p>
    </div>
  );
}
