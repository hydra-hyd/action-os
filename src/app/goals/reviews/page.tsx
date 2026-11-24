"use client";

import { useState } from "react";
import { GoalsNav } from "@/components/goals";
import { Badge, Button, Card, Field, PageHeader, SectionTitle, inputClass, useNow } from "@/components/ui";
import { REVIEW_LABEL, REVIEW_QUESTIONS, deleteReview, dueReviews, reviewStats, saveReview } from "@/lib/domain/reviews";
import type { ReviewKind } from "@/lib/domain/types";
import { useAppState, useHydrated } from "@/lib/store";

const KINDS = Object.keys(REVIEW_LABEL) as ReviewKind[];

export default function ReviewsPage() {
  const [s, dispatch] = useAppState();
  const hydrated = useHydrated();
  const now = useNow(60_000);
  const [kind, setKind] = useState<ReviewKind>("weekly");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  if (!hydrated) return <div className="h-64" />;

  const due = dueReviews(s, now);
  const stats = reviewStats(s, kind, now);
  const history = s.reviews.filter((r) => r.kind === kind).reverse();

  const save = () => {
    try {
      dispatch((st) => saveReview(st, kind, answers));
      setAnswers({});
      setMsg("保存しました");
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="定期レビュー" sub="行動と成果を振り返り、計画を修正します。全項目を埋める必要はありません。" />
      <GoalsNav />
      <div className="flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <Button key={k} variant={kind === k ? "secondary" : "ghost"} onClick={() => { setKind(k); setAnswers({}); setMsg(""); }} aria-pressed={kind === k}>
            {REVIEW_LABEL[k]}
            {due.includes(k) && <Badge tone="amber">時期</Badge>}
          </Button>
        ))}
      </div>

      <Card>
        <SectionTitle>実績データ（自動集計）</SectionTitle>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-zinc-100 py-1 dark:border-zinc-800">
              <dt className="truncate text-zinc-500">{k}</dt>
              <dd className="shrink-0 tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <SectionTitle>{REVIEW_LABEL[kind]}レビュー</SectionTitle>
        <div className="grid gap-3">
          {REVIEW_QUESTIONS[kind].map((q) => (
            <Field key={q.key} label={q.label}>
              <textarea className={inputClass} rows={2} value={answers[q.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })} />
            </Field>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="primary" onClick={save}>保存</Button>
          {msg && <span className="text-sm text-zinc-500">{msg}</span>}
        </div>
        <p className="mt-2 text-xs text-zinc-500">行動できなかった原因は、責めるためではなく次の改善のためのデータです。休息・目標の撤回も正当な選択です。</p>
      </Card>

      {history.length > 0 && (
        <Card>
          <SectionTitle>過去の{REVIEW_LABEL[kind]}レビュー</SectionTitle>
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.id}>
                <details className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
                  <summary className="cursor-pointer text-sm">{new Date(r.at).toLocaleString("ja-JP")}</summary>
                  <dl className="mt-2 space-y-1 text-sm">
                    {REVIEW_QUESTIONS[r.kind].filter((q) => r.answers[q.key]?.trim()).map((q) => (
                      <div key={q.key}>
                        <dt className="text-xs text-zinc-500">{q.label}</dt>
                        <dd className="whitespace-pre-wrap">{r.answers[q.key]}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-2 text-xs text-zinc-500">
                    当時の集計：{Object.entries(r.stats).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(" ／ ")}
                  </div>
                  <Button variant="ghost" className="mt-1" onClick={() => confirm("このレビューを削除しますか？") && dispatch((st) => deleteReview(st, r.id))}>
                    削除
                  </Button>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
