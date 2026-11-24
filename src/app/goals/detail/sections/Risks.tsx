"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, Field, SectionTitle, inputClass } from "@/components/ui";
import { PREMORTEM_PROMPTS, addRisk, changePlan, deleteRisk, saveWoop, updateGoal } from "@/lib/domain/goals";
import type { Risk } from "@/lib/domain/types";
import { tryDispatch, type SectionProps } from "./types";

export function RiskSection({ s, dispatch, goal }: SectionProps) {
  const risks = s.risks.filter((r) => r.goalId === goal.id).sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact);
  const linkedRule = goal.woop?.ruleId ? s.rules.find((r) => r.id === goal.woop!.ruleId) : null;
  const [woop, setWoop] = useState({
    wish: goal.woop?.wish ?? goal.title,
    outcome: goal.woop?.outcome ?? "",
    obstacle: goal.woop?.obstacle ?? "",
    ifText: linkedRule?.ifText ?? "",
    thenText: linkedRule?.thenText ?? "",
  });
  const [createRule, setCreateRule] = useState(!goal.woop?.ruleId);
  const [woopSaved, setWoopSaved] = useState(false);
  const blankRisk: Omit<Risk, "id" | "goalId" | "ruleId"> = { title: "", trigger: "", likelihood: 3, impact: 3, prevention: "", response: "" };
  const [r, setR] = useState(blankRisk);
  const [rule, setRule] = useState({ ifText: "", thenText: "" });
  const [plans, setPlans] = useState(goal.plans);
  const [error, setError] = useState("");

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>WOOP とメンタル・コントラスティング</SectionTitle>
        <p className="mb-3 text-xs text-zinc-500">理想の未来だけでなく、今の現実と内側の障害を並べて考え、障害への行動を if-then で決めておきます。</p>
        <div className="mb-3 grid gap-2 rounded-xl bg-zinc-50 p-3 text-sm sm:grid-cols-2 dark:bg-zinc-800/50">
          <div>
            <div className="text-xs text-zinc-500">理想（達成条件）</div>
            {goal.successCriteria || <span className="text-zinc-400">未設定（概要タブで入力）</span>}
          </div>
          <div>
            <div className="text-xs text-zinc-500">現実（現在地）</div>
            {goal.currentState || <span className="text-zinc-400">未設定（概要タブで入力）</span>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="W：Wish（達成したいこと）">
            <input className={inputClass} value={woop.wish} onChange={(e) => setWoop({ ...woop, wish: e.target.value })} />
          </Field>
          <Field label="O：Outcome（達成で得られる最高の結果）">
            <input className={inputClass} value={woop.outcome} onChange={(e) => setWoop({ ...woop, outcome: e.target.value })} />
          </Field>
          <Field label="O：Obstacle（自分の内側にある一番の障害）" hint="例：疲れていると机に向かえない、完璧にやろうとして始められない">
            <input className={inputClass} value={woop.obstacle} onChange={(e) => setWoop({ ...woop, obstacle: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="P：もし（障害が起きたら）">
              <input className={inputClass} value={woop.ifText} onChange={(e) => setWoop({ ...woop, ifText: e.target.value })} placeholder="疲れて机に向かえないとき" />
            </Field>
            <Field label="そのときは">
              <input className={inputClass} value={woop.thenText} onChange={(e) => setWoop({ ...woop, thenText: e.target.value })} placeholder="問題を1問だけ解く" />
            </Field>
          </div>
        </div>
        {!goal.woop?.ruleId ? (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-emerald-600" checked={createRule} onChange={(e) => setCreateRule(e.target.checked)} />
            Plan を if-then ルールとして登録する（実行を記録できます）
          </label>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">
            if-then ルールと連携済み（<Link href="/rules" className="underline">ルール画面</Link>で実行を記録・編集できます）
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              dispatch((st) => saveWoop(st, goal.id, woop, createRule));
              setWoopSaved(true);
            }}
          >
            WOOP を保存
          </Button>
          {woopSaved && <span className="text-sm text-emerald-700 dark:text-emerald-400">保存しました</span>}
        </div>
      </Card>

      <Card>
        <SectionTitle>プレモーテム（失敗した未来から考える）</SectionTitle>
        <p className="mb-2 text-sm text-zinc-500">「この目標は失敗に終わった」と仮定します。原因として考えられるものを選ぶと、リスク登録欄に入ります。</p>
        <div className="flex flex-wrap gap-2">
          {PREMORTEM_PROMPTS.map((p) => (
            <Button key={p} variant={r.title === p ? "secondary" : "ghost"} onClick={() => setR({ ...r, title: p })}>
              {p}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>リスク登録</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="リスク名">
            <input className={inputClass} value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} />
          </Field>
          <Field label="発生条件（兆候）">
            <input className={inputClass} value={r.trigger} onChange={(e) => setR({ ...r, trigger: e.target.value })} placeholder="例：2週間続けて週5時間を下回る" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="起こりやすさ（自己評価1-5）">
              <select className={inputClass} value={r.likelihood} onChange={(e) => setR({ ...r, likelihood: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="影響度（1-5）">
              <select className={inputClass} value={r.impact} onChange={(e) => setR({ ...r, impact: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="予防策">
            <input className={inputClass} value={r.prevention} onChange={(e) => setR({ ...r, prevention: e.target.value })} />
          </Field>
          <Field label="発生時の対処・代替計画">
            <input className={inputClass} value={r.response} onChange={(e) => setR({ ...r, response: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="if-then：もし（任意）">
              <input className={inputClass} value={rule.ifText} onChange={(e) => setRule({ ...rule, ifText: e.target.value })} />
            </Field>
            <Field label="そのときは">
              <input className={inputClass} value={rule.thenText} onChange={(e) => setRule({ ...rule, thenText: e.target.value })} />
            </Field>
          </div>
        </div>
        <Button
          variant="primary"
          className="mt-3"
          onClick={() => {
            if (tryDispatch(dispatch, (st) => addRisk(st, goal.id, r, rule.ifText && rule.thenText ? rule : null), setError)) {
              setR(blankRisk);
              setRule({ ifText: "", thenText: "" });
            }
          }}
        >
          リスクを登録
        </Button>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

        {risks.length > 0 && (
          <ul className="mt-4 space-y-2">
            {risks.map((x) => {
              const score = x.likelihood * x.impact;
              return (
                <li key={x.id} className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={score >= 15 ? "rose" : score >= 8 ? "amber" : "zinc"}>重大度 {score}</Badge>
                    <span className="font-medium">{x.title}</span>
                    {x.ruleId && <Badge tone="sky">if-then 連携</Badge>}
                    <Button variant="ghost" className="ml-auto" onClick={() => confirm(`リスク「${x.title}」を削除しますか？`) && dispatch((st) => deleteRisk(st, x.id))}>
                      削除
                    </Button>
                  </div>
                  <div className="mt-1 grid gap-1 text-xs text-zinc-500 sm:grid-cols-3">
                    <span>兆候：{x.trigger || "—"}</span>
                    <span>予防：{x.prevention || "—"}</span>
                    <span>対処：{x.response || "—"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>プラン A・B・C</SectionTitle>
        <p className="mb-3 text-xs text-zinc-500">計画どおりに進まなくても「やめる」以外の選択肢を用意しておきます。切り替えは履歴に残ります。</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["a", "b", "c"] as const).map((k) => (
            <div key={k} className={`rounded-xl border p-3 ${goal.activePlan === k ? "border-emerald-400 dark:border-emerald-700" : "border-zinc-200 dark:border-zinc-800"}`}>
              <Field label={{ a: "プランA：標準", b: "プランB：時間や体力に余裕がないとき", c: "プランC：大きな問題が起きたとき" }[k]}>
                <textarea className={inputClass} rows={4} value={plans[k]} onChange={(e) => setPlans({ ...plans, [k]: e.target.value })} />
              </Field>
              {goal.activePlan === k ? (
                <Badge tone="emerald">実行中</Badge>
              ) : (
                <Button
                  variant="ghost"
                  className="mt-2"
                  onClick={() => confirm(`プラン${k.toUpperCase()}に切り替えますか？（変更前の計画は履歴に残ります）`) && dispatch((st) => changePlan(st, goal.id, { activePlan: k, plans }, `プラン${goal.activePlan.toUpperCase()} → プラン${k.toUpperCase()} に切り替え`))}
                >
                  このプランに切り替える
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button className="mt-3" onClick={() => dispatch((st) => updateGoal(st, goal.id, { plans }))}>プランの内容を保存</Button>
      </Card>
    </div>
  );
}
