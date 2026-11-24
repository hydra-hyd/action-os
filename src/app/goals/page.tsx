"use client";

import Link from "next/link";
import { useState } from "react";
import { GoalsNav, HealthBadge, goalHref, pct } from "@/components/goals";
import { Badge, Button, Card, Field, PageHeader, SectionTitle, Stat, inputClass, useNow } from "@/components/ui";
import {
  FOCUS_LABEL,
  GOAL_CATEGORIES,
  GOAL_STATUS_LABEL,
  HORIZON_LABEL,
  OPEN_STATUSES,
  addGoal,
  addValue,
  deleteValue,
  diagnose,
  goalHealth,
  goalPriority,
  goalProgress,
  plannedProgress,
  resourceSummary,
  toDay,
  daysBetween,
} from "@/lib/domain/goals";
import type { GoalFocus, GoalHorizon } from "@/lib/domain/types";
import { useAppState, useHydrated } from "@/lib/store";

const FOCUS_ORDER: GoalFocus[] = ["main", "sub", "maintain", "hold", "future", "drop"];

export default function GoalsPage() {
  const [s, dispatch] = useAppState();
  const hydrated = useHydrated();
  const now = useNow(60_000);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("資格取得");
  const [horizon, setHorizon] = useState<GoalHorizon>("1y");
  const [dueDate, setDueDate] = useState("");
  const [parentId, setParentId] = useState("");
  const [focus, setFocus] = useState<GoalFocus>("sub");
  const [valueName, setValueName] = useState("");
  const [error, setError] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  if (!hydrated) return <div className="h-64" />;

  const today = toDay(now);
  const open = s.goals.filter((g) => OPEN_STATUSES.includes(g.status));
  const closed = s.goals.filter((g) => !OPEN_STATUSES.includes(g.status));
  const delayed = open.filter((g) => ["behind", "overdue"].includes(goalHealth(s, g.id, now)));
  const upcoming = s.milestones
    .filter((m) => !m.done && m.dueDate && m.dueDate >= today && daysBetween(today, m.dueDate) <= 30)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const res = resourceSummary(s, now);
  const issues = diagnose(s, now);
  const msTotal = s.milestones.length;
  const msDone = s.milestones.filter((m) => m.done).length;

  const create = () => {
    try {
      dispatch((st) => addGoal(st, { title, category, horizon, dueDate: dueDate || null, parentId: parentId || null, focus }));
      setTitle("");
      setDueDate("");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="目標管理" sub="価値観 → 長期目標 → マイルストーン → 今日のタスク。計画を作ることではなく、実行して成果を得ることが目的です。" />
      <GoalsNav />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="進行中の目標" value={`${open.length}件`} sub={`メイン ${open.filter((g) => g.focus === "main").length}件`} />
        <Stat label="遅れている目標" value={`${delayed.length}件`} />
        <Stat label="マイルストーン達成" value={msTotal ? `${msDone}/${msTotal}` : "データなし"} />
        <Stat label="週の配分時間" value={`${res.allocated.toFixed(1)}h`} sub={`利用可能 ${res.available.toFixed(1)}h${res.overloaded ? "・過密" : ""}`} />
      </div>

      {issues.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <SectionTitle aside={<Link href="/goals/resources" className="text-xs text-emerald-700 dark:text-emerald-400">詳しく見る</Link>}>
            戦略参謀からの指摘（ルールベース）
          </SectionTitle>
          <ul className="space-y-1 text-sm">
            {issues.slice(0, 4).map((d, i) => (
              <li key={i} className="flex gap-2">
                <Badge tone={d.level === "warn" ? "amber" : "zinc"}>{d.level === "warn" ? "要対応" : "提案"}</Badge>
                <span>{d.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle>新しい目標</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="目標名（必須）">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：公認会計士試験に合格する" />
          </Field>
          <Field label="カテゴリー" hint="一覧にないものは自由に入力できます">
            <input className={inputClass} list="goal-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="goal-categories">
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="時間軸">
            <select className={inputClass} value={horizon} onChange={(e) => setHorizon(e.target.value as GoalHorizon)}>
              {Object.entries(HORIZON_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="達成予定日">
            <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="親目標（任意）">
            <select className={inputClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">なし（最上位）</option>
              {s.goals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </Field>
          <Field label="選択と集中">
            <select className={inputClass} value={focus} onChange={(e) => setFocus(e.target.value as GoalFocus)}>
              {FOCUS_ORDER.map((f) => (
                <option key={f} value={f}>{FOCUS_LABEL[f]}</option>
              ))}
            </select>
          </Field>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <Button variant="primary" className="mt-3" onClick={create}>追加</Button>
        <p className="mt-2 text-xs text-zinc-500">追加後、詳細画面で理由・達成条件・マイルストーン・逆算計画などを設定できます。</p>
      </Card>

      {FOCUS_ORDER.map((f) => {
        const list = open.filter((g) => g.focus === f).sort((a, b) => goalPriority(b) - goalPriority(a));
        if (list.length === 0) return null;
        return (
          <Card key={f}>
            <SectionTitle>{FOCUS_LABEL[f]}</SectionTitle>
            <ul className="space-y-3">
              {list.map((g) => {
                const pr = goalProgress(s, g.id);
                const planned = plannedProgress(s, g.id, now);
                const parent = g.parentId ? s.goals.find((x) => x.id === g.parentId) : null;
                return (
                  <li key={g.id}>
                    <Link href={goalHref(g.id)} className="block rounded-xl p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{g.title}</span>
                        <HealthBadge s={s} id={g.id} now={now} />
                        <Badge>{GOAL_STATUS_LABEL[g.status]}</Badge>
                        <span className="text-xs text-zinc-500">
                          {g.category} ・ 優先度 {Math.round(goalPriority(g))}
                          {g.dueDate && ` ・ ${g.dueDate}（残り${Math.max(0, daysBetween(today, g.dueDate))}日）`}
                          {parent && ` ・ 親：${parent.title}`}
                        </span>
                      </div>
                      <div className="relative mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pr.value * 100}%` }} />
                        {planned !== null && (
                          <div className="absolute -top-1 h-4 w-0.5 bg-zinc-700 dark:bg-zinc-200" style={{ left: `${planned * 100}%` }} title={`計画 ${pct(planned)}`} />
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        実績 {pct(pr.value)}
                        {planned !== null && ` ／ 計画 ${pct(planned)}`}（縦線が計画上の位置）
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      {open.length === 0 && (
        <Card>
          <p className="text-sm text-zinc-500">まだ目標がありません。上のフォームから1つ登録してみましょう。</p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <SectionTitle>30日以内の期限（マイルストーン）</SectionTitle>
          {upcoming.length === 0 ? (
            <p className="text-sm text-zinc-500">データなし</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {upcoming.slice(0, 8).map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <Link href={goalHref(m.goalId)} className="truncate hover:underline">{m.title}</Link>
                  <span className="shrink-0 tabular-nums text-zinc-500">{m.dueDate}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <SectionTitle>価値観</SectionTitle>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                dispatch((st) => addValue(st, valueName));
                setValueName("");
              } catch {
                /* 空入力は無視 */
              }
            }}
          >
            <input className={inputClass} value={valueName} onChange={(e) => setValueName(e.target.value)} placeholder="例：自律性・専門性・家族" aria-label="価値観" />
            <Button type="submit">追加</Button>
          </form>
          <ul className="mt-2 flex flex-wrap gap-1">
            {s.values.map((v) => (
              <li key={v.id} className="flex items-center gap-1 rounded-full bg-sky-50 py-0.5 pr-1 pl-3 text-sm dark:bg-sky-900/30">
                {v.name}
                <span className="text-xs text-zinc-500">（{s.goals.filter((g) => g.valueIds.includes(v.id)).length}）</span>
                <button
                  type="button"
                  className="rounded-full px-1.5 text-zinc-400 hover:text-rose-600"
                  aria-label={`${v.name}を削除`}
                  onClick={() => {
                    if (confirm(`価値観「${v.name}」を削除しますか？目標との紐付けも外れます。`)) dispatch((st) => deleteValue(st, v.id));
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500">目標は「価値観」に向かう具体的な到達点です。価値観そのものに「達成」はありません。</p>
        </Card>
      </div>

      {closed.length > 0 && (
        <Card>
          <SectionTitle aside={<Button variant="ghost" onClick={() => setShowClosed((v) => !v)}>{showClosed ? "閉じる" : "表示"}</Button>}>
            達成・撤回・一時停止（{closed.length}件）
          </SectionTitle>
          {showClosed && (
            <ul className="space-y-1 text-sm">
              {closed.map((g) => (
                <li key={g.id} className="flex items-center gap-2">
                  <Badge tone={g.status === "achieved" ? "emerald" : "zinc"}>{GOAL_STATUS_LABEL[g.status]}</Badge>
                  <Link href={goalHref(g.id)} className="hover:underline">{g.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
