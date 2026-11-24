import type { PriorityWeights, Task } from "./types";
import { clamp } from "./util";

// 要件 20 の初期重み
export const DEFAULT_WEIGHTS: PriorityWeights = {
  importance: 0.3,
  urgency: 0.25,
  valueAlignment: 0.2,
  longTermImpact: 0.15,
  feasibility: 0.1,
};

const ACTIVE: Task["status"][] = ["todo", "doing", "paused", "interrupted", "replan", "postponed", "minimum_done"];

export function isActive(t: Task): boolean {
  return ACTIVE.includes(t.status);
}

/** 締切に応じた緊急度の補正（0〜30） */
export function deadlineBoost(deadline: string | null, now: Date): number {
  if (!deadline) return 0;
  const hours = (new Date(deadline).getTime() - now.getTime()) / 3_600_000;
  if (hours < 0) return 30; // 期限切れ
  if (hours < 24) return 25;
  if (hours < 72) return 15;
  if (hours < 168) return 5;
  return 0;
}

/**
 * Priority = Σ weight × score（重みは合計1に正規化）+ 締切補正。
 * 心理的負担が大きいことを理由に優先度は下げない（要件20）。
 */
export function priorityScore(t: Task, weights: PriorityWeights = DEFAULT_WEIGHTS, now = new Date()): number {
  const sum =
    weights.importance + weights.urgency + weights.valueAlignment + weights.longTermImpact + weights.feasibility;
  const w = sum > 0 ? sum : 1;
  const base =
    (weights.importance * t.importance +
      weights.urgency * t.urgency +
      weights.valueAlignment * t.valueAlignment +
      weights.longTermImpact * t.longTermImpact +
      weights.feasibility * t.feasibility) /
    w;
  return clamp(base + deadlineBoost(t.deadline, now), 0, 130);
}

export function rankTasks(tasks: Task[], weights?: PriorityWeights, now = new Date()): Task[] {
  return tasks
    .filter(isActive)
    .map((t) => ({ t, s: priorityScore(t, weights, now) + (t.isMostImportant ? 1000 : 0) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
}

/**
 * Eat That Frog：重要度が高く、かつ先延ばしされている（未着手で作成から時間が経つ／予定時刻を過ぎた）タスク。
 */
export function pickFrog(tasks: Task[], now = new Date()): Task | null {
  const candidates = tasks.filter((t) => isActive(t) && !t.firstStartedAt && t.importance >= 60);
  if (candidates.length === 0) return null;
  const procrastination = (t: Task) => {
    const ref = t.plannedStart ?? t.createdAt;
    return Math.max(0, now.getTime() - new Date(ref).getTime());
  };
  return [...candidates].sort(
    (a, b) => b.importance + procrastination(b) / 3_600_000 - (a.importance + procrastination(a) / 3_600_000),
  )[0];
}

/** 心理的負担が大きいタスクには分解を促す */
export function needsBreakdown(t: Task): boolean {
  return t.psychLoad >= 70 && t.steps.length === 0;
}
