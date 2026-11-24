"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, PageHeader, SectionTitle, inputClass } from "@/components/ui";
import { addRule, deleteRule, logRule, ruleExecutionRate, ruleSuggestions, toggleRule } from "@/lib/domain/actions";
import { formatRate } from "@/lib/domain/kpi";
import type { IfThenRule } from "@/lib/domain/types";
import { useAppState, useHydrated } from "@/lib/store";

const TRIGGERS: { key: IfThenRule["trigger"]; label: string }[] = [
  { key: "time", label: "時間" },
  { key: "habit", label: "既存の習慣" },
  { key: "place", label: "場所" },
  { key: "emotion", label: "感情" },
  { key: "temptation", label: "誘惑" },
  { key: "task", label: "タスク" },
  { key: "other", label: "その他" },
];

const EXAMPLES: Pick<IfThenRule, "ifText" | "thenText" | "trigger">[] = [
  { ifText: "朝起きたら", thenText: "今日の最重要タスクを確認する", trigger: "habit" },
  { ifText: "歯磨きをしたら", thenText: "英単語を5個覚える", trigger: "habit" },
  { ifText: "面倒くさいと感じたら", thenText: "30秒だけ取り組む", trigger: "emotion" },
  { ifText: "SNSを見たくなったら", thenText: "衝動を10呼吸だけ観察する", trigger: "temptation" },
  { ifText: "予定を守れなかったら", thenText: "最低目標に切り替える", trigger: "task" },
  { ifText: "就寝前になったら", thenText: "明日の最初の行動を決める", trigger: "time" },
];

export default function RulesPage() {
  const [s, dispatch] = useAppState();
  const hydrated = useHydrated();
  const [ifText, setIf] = useState("");
  const [thenText, setThen] = useState("");
  const [trigger, setTrigger] = useState<IfThenRule["trigger"]>("habit");
  const [error, setError] = useState("");

  if (!hydrated) return <div className="h-64" />;

  const submit = () => {
    try {
      dispatch((st) => addRule(st, { ifText, thenText, trigger }));
      setIf("");
      setThen("");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="if-then プランニング" sub="「もし〜したら、〜する」を事前に決めて、その場の判断を減らします。感情などの条件は、気づいたときに手動で記録します。" />

      <Card>
        <SectionTitle>新しいルール</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="IF（もし〜したら）">
            <input className={inputClass} value={ifText} onChange={(e) => setIf(e.target.value)} placeholder="例：大学から帰宅したら" />
          </Field>
          <Field label="THEN（〜する）">
            <input className={inputClass} value={thenText} onChange={(e) => setThen(e.target.value)} placeholder="例：テキストを開く" />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {TRIGGERS.map((t) => (
            <Button key={t.key} variant={trigger === t.key ? "secondary" : "ghost"} onClick={() => setTrigger(t.key)} aria-pressed={trigger === t.key}>
              {t.label}
            </Button>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <Button variant="primary" className="mt-3" onClick={submit}>追加</Button>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-zinc-500">例から選ぶ</summary>
          <ul className="mt-2 space-y-1">
            {EXAMPLES.map((ex) => (
              <li key={ex.ifText}>
                <button
                  type="button"
                  className="text-left text-sm text-emerald-700 hover:underline dark:text-emerald-400"
                  onClick={() => {
                    setIf(ex.ifText);
                    setThen(ex.thenText);
                    setTrigger(ex.trigger);
                  }}
                >
                  {ex.ifText} → {ex.thenText}
                </button>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      {s.rules.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">まだルールがありません。</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {s.rules.map((r) => {
            const { rate, count } = ruleExecutionRate(s, r.id);
            const tips = ruleSuggestions(rate, count);
            return (
              <li key={r.id}>
                <Card className={r.active ? "" : "opacity-60"}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        <span className="text-zinc-500">IF</span> {r.ifText} <span className="text-zinc-500">→ THEN</span> {r.thenText}
                      </div>
                      <div className="mt-1 flex gap-2 text-xs text-zinc-500">
                        <Badge>{TRIGGERS.find((t) => t.key === r.trigger)?.label}</Badge>
                        実行率 {formatRate(rate)}（{count}回記録）
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="primary" onClick={() => dispatch((st) => logRule(st, r.id, true))} disabled={!r.active}>実行した</Button>
                      <Button onClick={() => dispatch((st) => logRule(st, r.id, false))} disabled={!r.active}>できなかった</Button>
                      <Button variant="ghost" onClick={() => dispatch((st) => toggleRule(st, r.id))}>{r.active ? "停止" : "再開"}</Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (confirm("このルールを削除しますか？")) dispatch((st) => deleteRule(st, r.id));
                        }}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                  {tips.length > 0 && (
                    <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
                      <div className="mb-1 font-medium">ルールを調整してみませんか？（ルールベースの提案）</div>
                      <ul className="list-disc pl-5">
                        {tips.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
