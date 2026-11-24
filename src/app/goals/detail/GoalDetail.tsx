"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { GoalsNav, HealthBadge, goalHref, pct } from "@/components/goals";
import { Badge, Button, Card, ProgressBar, useNow } from "@/components/ui";
import { BASIS_LABEL, GOAL_STATUS_LABEL, FOCUS_LABEL, deleteGoal, goalPath, goalProgress, plannedProgress } from "@/lib/domain/goals";
import { useAppState, useHydrated } from "@/lib/store";
import { OverviewSection } from "./sections/Overview";
import { MilestonesSection } from "./sections/Milestones";
import { PlanSection } from "./sections/Plan";
import { StrategySection } from "./sections/Strategy";
import { RiskSection } from "./sections/Risks";
import { ForecastSection } from "./sections/Forecast";
import { TasksSection } from "./sections/Tasks";
import { HistorySection } from "./sections/History";

const TABS = [
  { key: "overview", label: "概要・SMART" },
  { key: "milestones", label: "マイルストーン・KPI" },
  { key: "plan", label: "逆算計画" },
  { key: "strategy", label: "戦略比較" },
  { key: "risks", label: "WOOP・リスク" },
  { key: "forecast", label: "予測・修正" },
  { key: "tasks", label: "タスク" },
  { key: "history", label: "変更履歴" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export function GoalDetail() {
  const [s, dispatch] = useAppState();
  const hydrated = useHydrated();
  const now = useNow(60_000);
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>((params.get("tab") as TabKey) ?? "overview");

  if (!hydrated) return <div className="h-64" />;
  const id = params.get("id") ?? "";
  const goal = s.goals.find((g) => g.id === id);
  if (!goal) {
    return (
      <div>
        <GoalsNav />
        <Card>
          <p className="text-sm text-zinc-500">目標が見つかりません。</p>
          <Link href="/goals" className="text-sm text-emerald-700 underline">目標一覧へ</Link>
        </Card>
      </div>
    );
  }

  const pr = goalProgress(s, id);
  const planned = plannedProgress(s, id, now);
  const path = goalPath(s, id);
  const props = { s, dispatch, goal, now, goTab: setTab };

  return (
    <div className="space-y-4">
      <GoalsNav />
      {path.length > 1 && (
        <nav aria-label="親目標" className="text-xs text-zinc-500">
          {path.slice(0, -1).map((g) => (
            <span key={g.id}>
              <Link href={goalHref(g.id)} className="hover:underline">{g.title}</Link>
              {" › "}
            </span>
          ))}
        </nav>
      )}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{goal.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <HealthBadge s={s} id={id} now={now} />
              <Badge>{GOAL_STATUS_LABEL[goal.status]}</Badge>
              <Badge tone="sky">{FOCUS_LABEL[goal.focus]}</Badge>
              <span>{goal.category}</span>
              {goal.dueDate && <span>期限 {goal.dueDate}</span>}
              {goal.activePlan !== "a" && <Badge tone="amber">プラン{goal.activePlan.toUpperCase()}で実行中</Badge>}
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm(`目標「${goal.title}」を削除しますか？\nマイルストーン・KPI・リスク・戦略も削除されます。紐づくタスクは残ります（紐付けのみ解除）。`)) {
                dispatch((st) => deleteGoal(st, id));
                router.push("/goals");
              }
            }}
          >
            削除
          </Button>
        </div>
        <div className="mt-3">
          <ProgressBar value={pr.value * 100} max={100} />
          <p className="mt-1 text-xs text-zinc-500">
            実績 {pct(pr.value)}
            {planned !== null && ` ／ 計画 ${pct(planned)}`} ・ 算出方法：{BASIS_LABEL[pr.basis]}
          </p>
        </div>
      </Card>

      <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Button key={t.key} role="tab" aria-selected={tab === t.key} variant={tab === t.key ? "secondary" : "ghost"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "overview" && <OverviewSection {...props} />}
      {tab === "milestones" && <MilestonesSection {...props} />}
      {tab === "plan" && <PlanSection {...props} />}
      {tab === "strategy" && <StrategySection {...props} />}
      {tab === "risks" && <RiskSection {...props} />}
      {tab === "forecast" && <ForecastSection {...props} />}
      {tab === "tasks" && <TasksSection {...props} />}
      {tab === "history" && <HistorySection {...props} />}
    </div>
  );
}
