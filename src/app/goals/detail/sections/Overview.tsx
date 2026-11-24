"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, SectionTitle, inputClass } from "@/components/ui";
import {
  FOCUS_LABEL,
  GOAL_CATEGORIES,
  GOAL_FACTOR_LABEL,
  GOAL_STATUS_LABEL,
  HORIZON_LABEL,
  changePlan,
  descendantIds,
  goalPriority,
  setGoalStatus,
  smartCheck,
  updateGoal,
} from "@/lib/domain/goals";
import type { Goal, GoalFocus, GoalHorizon, GoalStatus } from "@/lib/domain/types";
import { tryDispatch, type SectionProps } from "./types";

export function OverviewSection({ s, dispatch, goal, goTab }: SectionProps) {
  const [d, setD] = useState<Goal>(goal);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<Goal>) => {
    setD((x) => ({ ...x, ...patch }));
    setSaved(false);
  };
  const excluded = new Set(descendantIds(s, goal.id));
  const smart = smartCheck(s, d);

  const save = () => {
    const { status, dueDate, ...rest } = d;
    const ok = tryDispatch(
      dispatch,
      (st) => {
        let x = updateGoal(st, goal.id, rest);
        // 期限の変更は重要な計画変更として履歴を残す
        if (dueDate !== goal.dueDate) x = changePlan(x, goal.id, { dueDate }, `期限を ${goal.dueDate ?? "未設定"} → ${dueDate ?? "未設定"} に変更`);
        if (status !== goal.status) x = setGoalStatus(x, goal.id, status);
        return x;
      },
      setError,
    );
    if (ok) setSaved(true);
  };

  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>SMART チェック</SectionTitle>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {smart.map((c) => (
            <li key={c.key} className="flex items-start gap-2">
              <Badge tone={c.ok ? "emerald" : "amber"}>{c.key}</Badge>
              <span>
                {c.label}
                {!c.ok && <span className="block text-xs text-zinc-500">{c.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          M（測定可能）は
          <button type="button" className="mx-1 text-emerald-700 underline dark:text-emerald-400" onClick={() => goTab("milestones")}>
            マイルストーン・KPI
          </button>
          で設定します。
        </p>
      </Card>

      <Card>
        <SectionTitle>基本情報</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="目標名">
            <input className={inputClass} value={d.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="カテゴリー">
            <input className={inputClass} list="detail-categories" value={d.category} onChange={(e) => set({ category: e.target.value })} />
            <datalist id="detail-categories">
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="説明">
            <textarea className={inputClass} rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <Field label="親目標">
            <select className={inputClass} value={d.parentId ?? ""} onChange={(e) => set({ parentId: e.target.value || null })}>
              <option value="">なし（最上位）</option>
              {s.goals.filter((g) => !excluded.has(g.id)).map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </Field>
          <Field label="時間軸">
            <select className={inputClass} value={d.horizon} onChange={(e) => set({ horizon: e.target.value as GoalHorizon })}>
              {Object.entries(HORIZON_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="開始予定日">
              <input type="date" className={inputClass} value={d.startDate ?? ""} onChange={(e) => set({ startDate: e.target.value || null })} />
            </Field>
            <Field label="達成予定日" hint="変更すると履歴に残ります">
              <input type="date" className={inputClass} value={d.dueDate ?? ""} onChange={(e) => set({ dueDate: e.target.value || null })} />
            </Field>
          </div>
          <Field label="状態">
            <select className={inputClass} value={d.status} onChange={(e) => set({ status: e.target.value as GoalStatus })}>
              {Object.entries(GOAL_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="選択と集中">
            <select className={inputClass} value={d.focus} onChange={(e) => set({ focus: e.target.value as GoalFocus })}>
              {Object.entries(FOCUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>目的と価値観（心のコンパス）</SectionTitle>
        <div className="grid gap-3">
          <div>
            <div className="mb-1 text-sm font-medium">関連する価値観</div>
            {s.values.length === 0 ? (
              <p className="text-xs text-zinc-500">価値観は目標管理ダッシュボードで登録できます。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {s.values.map((v) => (
                  <label key={v.id} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-emerald-600"
                      checked={d.valueIds.includes(v.id)}
                      onChange={(e) => set({ valueIds: e.target.checked ? [...d.valueIds, v.id] : d.valueIds.filter((x) => x !== v.id) })}
                    />
                    {v.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <Field label="達成したい理由">
            <textarea className={inputClass} rows={2} value={d.why} onChange={(e) => set({ why: e.target.value })} />
          </Field>
          <div>
            <div className="mb-1 text-sm font-medium">5回のWhy</div>
            <p className="mb-2 text-xs text-zinc-500">
              「なぜそれを達成したい？」を繰り返します。途中で「人に認められたい」「比べて負けたくない」など外からの期待が出てきたら、それとは別に自分が本当に大切にしたいことは何かも考えてみてください。
            </p>
            <ol className="space-y-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs text-zinc-500">Why {i + 1}</span>
                  <input
                    className={inputClass}
                    value={d.whys[i] ?? ""}
                    onChange={(e) => {
                      const whys = [...d.whys];
                      whys[i] = e.target.value;
                      set({ whys });
                    }}
                    placeholder={i === 0 ? `なぜ「${d.title}」を達成したい？` : "それはなぜ大切？"}
                  />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>現在地と達成条件</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="現在地（現状）">
            <textarea className={inputClass} rows={3} value={d.currentState} onChange={(e) => set({ currentState: e.target.value })} placeholder="例：簿記2級。会計の勉強は週5時間" />
          </Field>
          <Field label="達成条件（何がどうなったら達成か）">
            <textarea className={inputClass} rows={3} value={d.successCriteria} onChange={(e) => set({ successCriteria: e.target.value })} placeholder="例：論文式試験に合格し、合格証書を受け取る" />
          </Field>
          <Field label="必要な知識・スキル">
            <textarea className={inputClass} rows={2} value={d.requiredSkills} onChange={(e) => set({ requiredSkills: e.target.value })} />
          </Field>
          <Field label="前提条件">
            <textarea className={inputClass} rows={2} value={d.prerequisites} onChange={(e) => set({ prerequisites: e.target.value })} />
          </Field>
          <Field label="依存する目標（先に達成が必要）">
            <select
              multiple
              className={`${inputClass} h-24`}
              value={d.dependsOn}
              onChange={(e) => set({ dependsOn: Array.from(e.target.selectedOptions).map((o) => o.value) })}
            >
              {s.goals.filter((g) => g.id !== goal.id).map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </Field>
          <Field label="達成後の報酬">
            <input className={inputClass} value={d.reward} onChange={(e) => set({ reward: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>リソース</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="週の配分時間（h）">
            <input type="number" min={0} step={0.5} className={inputClass} value={d.weeklyHours ?? ""} onChange={(e) => set({ weeklyHours: num(e.target.value) })} />
          </Field>
          <Field label="必要予算（円）">
            <input type="number" min={0} className={inputClass} value={d.budget ?? ""} onChange={(e) => set({ budget: num(e.target.value) })} />
          </Field>
          <Field label="使用済み（円）">
            <input type="number" min={0} className={inputClass} value={d.spent} onChange={(e) => set({ spent: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="手動の進捗（%）" hint="マイルストーン・指標・子目標・タスクが無い場合のみ使用">
            <input type="number" min={0} max={100} className={inputClass} value={d.manualProgress ?? ""} onChange={(e) => set({ manualProgress: num(e.target.value) })} />
          </Field>
        </div>
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-zinc-500">
            優先度の評価（参考値 {Math.round(goalPriority(d))}／最終判断はあなた）
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(Object.keys(GOAL_FACTOR_LABEL) as (keyof Goal["factors"])[]).map((k) => (
              <label key={k} className="text-sm">
                <div className="flex justify-between">
                  <span>{GOAL_FACTOR_LABEL[k]}</span>
                  <span className="tabular-nums text-zinc-500">{d.factors[k]}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={d.factors[k]}
                  onChange={(e) => set({ factors: { ...d.factors, [k]: Number(e.target.value) } })}
                  className="w-full accent-emerald-600"
                />
              </label>
            ))}
            <label className="text-sm">
              <div className="flex justify-between">
                <span>想定難易度</span>
                <span className="tabular-nums text-zinc-500">{d.difficulty}</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={d.difficulty} onChange={(e) => set({ difficulty: Number(e.target.value) })} className="w-full accent-emerald-600" />
            </label>
          </div>
        </details>
      </Card>

      <div className="sticky bottom-20 z-10 flex items-center gap-3 md:bottom-4">
        <Button variant="primary" onClick={save}>変更を保存</Button>
        {saved && <span className="text-sm text-emerald-700 dark:text-emerald-400">保存しました</span>}
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>
    </div>
  );
}
