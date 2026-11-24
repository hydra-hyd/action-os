/**
 * 長期目標・戦略計画のドメインロジック（純粋関数）。
 *
 * AI は未接続。逆算計画・戦略シナリオ・診断はすべて決定的なルールベースで計算し、
 * UI では「ルールベース」と明示する。提案は登録前にユーザーが確認・編集・承認する。
 */
import { addRule, addTask } from "./actions";
import type {
  AppState,
  CriterionKey,
  Goal,
  GoalFocus,
  GoalHorizon,
  GoalMetric,
  GoalStatus,
  Milestone,
  PlanVersion,
  Risk,
  Strategy,
  Value,
} from "./types";
import { clamp, uid } from "./util";
import { awardXp } from "./xp";

// ---------------- ラベル ----------------

export const HORIZON_LABEL: Record<GoalHorizon, string> = {
  life: "人生全体",
  "20y": "20年後",
  "10y": "10年後",
  "5y": "5年後",
  "3y": "3年後",
  "1y": "1年後",
  "6m": "半年後",
  "3m": "3か月後",
  "1m": "1か月後",
  "1w": "1週間後",
  today: "今日",
  custom: "自由設定",
};

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  idea: "構想中",
  planning: "計画中",
  active: "実行中",
  on_track: "順調",
  delayed: "遅延",
  needs_review: "要見直し",
  paused: "一時停止",
  achieved: "達成",
  withdrawn: "撤回",
};

export const FOCUS_LABEL: Record<GoalFocus, string> = {
  main: "メイン目標",
  sub: "サブ目標",
  maintain: "維持目標",
  hold: "保留",
  future: "将来実行",
  drop: "撤回候補",
};

export const GOAL_CATEGORIES = [
  "キャリア",
  "学業",
  "資格取得",
  "経済的自立",
  "資産形成",
  "健康",
  "身体能力",
  "人間関係",
  "恋愛",
  "家族",
  "知識・教養",
  "スキル",
  "趣味",
  "社会貢献",
  "その他",
];

export const CRITERIA: { key: CriterionKey; label: string }[] = [
  { key: "speed", label: "達成の速さ" },
  { key: "timeLoad", label: "時間負担の軽さ" },
  { key: "cost", label: "費用の安さ" },
  { key: "difficulty", label: "取り組みやすさ" },
  { key: "risk", label: "リスクの低さ" },
  { key: "valueFit", label: "価値観との一致" },
  { key: "sideEffects", label: "他の目標への悪影響の少なさ" },
];

const DEFAULT_MATRIX_WEIGHTS: Record<CriterionKey, number> = {
  speed: 3,
  timeLoad: 3,
  cost: 2,
  difficulty: 2,
  risk: 3,
  valueFit: 4,
  sideEffects: 3,
};

/** 目標の状態のうち「進行中」とみなすもの */
export const OPEN_STATUSES: GoalStatus[] = ["idea", "planning", "active", "on_track", "delayed", "needs_review"];
const WORKING_STATUSES: GoalStatus[] = ["active", "on_track", "delayed", "needs_review"];

// ---------------- 日付ユーティリティ ----------------

const DAY = 86_400_000;

/** YYYY-MM-DD をローカル日付の0時として解釈 */
export function parseDay(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function toDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d: string, n: number): string {
  const x = parseDay(d);
  x.setDate(x.getDate() + n);
  return toDay(x);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY);
}

// ---------------- 価値観 ----------------

export function addValue(s: AppState, name: string, note = "", now = new Date()): AppState {
  if (!name.trim()) throw new Error("価値観の名前を入力してください");
  const v: Value = { id: uid(), name: name.trim(), note, createdAt: now.toISOString() };
  return { ...s, values: [...s.values, v] };
}

export function deleteValue(s: AppState, id: string): AppState {
  return {
    ...s,
    values: s.values.filter((v) => v.id !== id),
    goals: s.goals.map((g) => ({ ...g, valueIds: g.valueIds.filter((x) => x !== id) })),
  };
}

// ---------------- 目標 CRUD ----------------

export type GoalInput = Partial<Omit<Goal, "id" | "createdAt" | "updatedAt">> & { title: string };

export function newGoal(input: GoalInput, now = new Date()): Goal {
  const iso = now.toISOString();
  return {
    parentId: null,
    description: "",
    category: "その他",
    valueIds: [],
    why: "",
    whys: [],
    horizon: "1y",
    startDate: toDay(now),
    dueDate: null,
    status: "planning",
    focus: "sub",
    currentState: "",
    successCriteria: "",
    difficulty: 50,
    factors: {
      longTermImpact: 50,
      valueFit: 50,
      urgency: 50,
      benefit: 50,
      ripple: 50,
      resourceLightness: 50,
      feasibility: 50,
      opportunityLoss: 50,
    },
    weeklyHours: null,
    budget: null,
    spent: 0,
    requiredSkills: "",
    prerequisites: "",
    reward: "",
    dependsOn: [],
    woop: null,
    plans: { a: "", b: "", c: "" },
    activePlan: "a",
    manualProgress: null,
    matrixWeights: { ...DEFAULT_MATRIX_WEIGHTS },
    ...input,
    title: input.title.trim(),
    id: uid(),
    createdAt: iso,
    updatedAt: iso,
  };
}

export function addGoal(s: AppState, input: GoalInput, now = new Date()): AppState {
  if (!input.title.trim()) throw new Error("目標名は必須です");
  if (input.parentId && !s.goals.some((g) => g.id === input.parentId)) throw new Error("親目標が見つかりません");
  return { ...s, goals: [...s.goals, newGoal(input, now)] };
}

/** 親子関係が循環しないか */
export function wouldCreateCycle(goals: Goal[], goalId: string, newParentId: string | null): boolean {
  let cur = newParentId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === goalId) return true;
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = goals.find((g) => g.id === cur)?.parentId ?? null;
  }
  return false;
}

export function updateGoal(s: AppState, id: string, patch: Partial<Goal>, now = new Date()): AppState {
  if (patch.title !== undefined && !patch.title.trim()) throw new Error("目標名は必須です");
  if (patch.parentId !== undefined && wouldCreateCycle(s.goals, id, patch.parentId)) {
    throw new Error("親子関係が循環するため設定できません");
  }
  const next = {
    ...s,
    goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch, id, updatedAt: now.toISOString() } : g)),
  };
  return recordProgress(next, id, now);
}

/** 目標を削除。子目標は親を付け替え、紐づくタスクは残して紐付けだけ外す（データを消さない） */
export function deleteGoal(s: AppState, id: string): AppState {
  const g = s.goals.find((x) => x.id === id);
  if (!g) return s;
  const metricIds = new Set(s.metrics.filter((m) => m.goalId === id).map((m) => m.id));
  return {
    ...s,
    goals: s.goals
      .filter((x) => x.id !== id)
      .map((x) => ({
        ...x,
        parentId: x.parentId === id ? g.parentId : x.parentId,
        dependsOn: x.dependsOn.filter((d) => d !== id),
      })),
    milestones: s.milestones.filter((m) => m.goalId !== id),
    metrics: s.metrics.filter((m) => m.goalId !== id),
    metricLogs: s.metricLogs.filter((l) => !metricIds.has(l.metricId)),
    risks: s.risks.filter((r) => r.goalId !== id),
    strategies: s.strategies.filter((x) => x.goalId !== id),
    tasks: s.tasks.map((t) => (t.goalId === id ? { ...t, goalId: null, milestoneId: null } : t)),
  };
}

export function childrenOf(s: AppState, id: string | null): Goal[] {
  return s.goals.filter((g) => g.parentId === id);
}

/** 自身と子孫の目標ID */
export function descendantIds(s: AppState, id: string): string[] {
  const out = [id];
  for (const c of childrenOf(s, id)) out.push(...descendantIds(s, c.id));
  return out;
}

export function goalPath(s: AppState, id: string): Goal[] {
  const out: Goal[] = [];
  let cur = s.goals.find((g) => g.id === id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parentId ? s.goals.find((g) => g.id === cur!.parentId) : undefined;
  }
  return out;
}

// ---------------- 計画の変更履歴 ----------------

export function snapshotPlan(s: AppState, goalId: string, reason: string, now = new Date()): AppState {
  const goal = s.goals.find((g) => g.id === goalId);
  if (!goal) return s;
  const v: PlanVersion = {
    id: uid(),
    goalId,
    at: now.toISOString(),
    reason,
    snapshot: { goal: structuredClone(goal), milestones: structuredClone(s.milestones.filter((m) => m.goalId === goalId)) },
  };
  return { ...s, planVersions: [...s.planVersions, v] };
}

/** 重要な計画変更（期限・プラン切替など）。必ず変更前を履歴に残す */
export function changePlan(s: AppState, goalId: string, patch: Partial<Goal>, reason: string, now = new Date()): AppState {
  return updateGoal(snapshotPlan(s, goalId, reason, now), goalId, patch, now);
}

/** 履歴から計画（目標の設定とマイルストーン）を復元。復元前の状態も履歴に残す */
export function restorePlanVersion(s: AppState, versionId: string, now = new Date()): AppState {
  const v = s.planVersions.find((x) => x.id === versionId);
  if (!v || !s.goals.some((g) => g.id === v.goalId)) return s;
  let st = snapshotPlan(s, v.goalId, `履歴（${new Date(v.at).toLocaleDateString("ja-JP")}）から復元する前の状態`, now);
  const { id: _omit, createdAt: _c, ...goalFields } = v.snapshot.goal;
  void _omit;
  void _c;
  st = {
    ...st,
    goals: st.goals.map((g) => (g.id === v.goalId ? { ...g, ...goalFields, id: g.id, parentId: g.parentId, updatedAt: now.toISOString() } : g)),
    milestones: [...st.milestones.filter((m) => m.goalId !== v.goalId), ...structuredClone(v.snapshot.milestones)],
  };
  return recordProgress(st, v.goalId, now);
}

// ---------------- マイルストーン ----------------

export type MilestoneInput = Partial<Omit<Milestone, "id" | "goalId">> & { title: string };

export function addMilestone(s: AppState, goalId: string, input: MilestoneInput, now = new Date()): AppState {
  if (!input.title.trim()) throw new Error("マイルストーン名は必須です");
  const order = s.milestones.filter((m) => m.goalId === goalId).length;
  const m: Milestone = {
    startDate: null,
    dueDate: null,
    criteria: "",
    weight: 3,
    done: false,
    doneAt: null,
    xp: 100,
    reward: "",
    dependsOn: [],
    order,
    ...input,
    title: input.title.trim(),
    id: uid(),
    goalId,
  };
  return recordProgress({ ...s, milestones: [...s.milestones, m] }, goalId, now);
}

export function updateMilestone(s: AppState, id: string, patch: Partial<Milestone>, now = new Date()): AppState {
  const m = s.milestones.find((x) => x.id === id);
  if (!m) return s;
  return recordProgress(
    { ...s, milestones: s.milestones.map((x) => (x.id === id ? { ...x, ...patch, id, goalId: x.goalId } : x)) },
    m.goalId,
    now,
  );
}

export function deleteMilestone(s: AppState, id: string, now = new Date()): AppState {
  const m = s.milestones.find((x) => x.id === id);
  if (!m) return s;
  return recordProgress(
    {
      ...s,
      milestones: s.milestones.filter((x) => x.id !== id).map((x) => ({ ...x, dependsOn: x.dependsOn.filter((d) => d !== id) })),
      tasks: s.tasks.map((t) => (t.milestoneId === id ? { ...t, milestoneId: null } : t)),
    },
    m.goalId,
    now,
  );
}

/** マイルストーンXPの上限（1日あたりの付与回数・1件あたりの最大値）。XP稼ぎが目的化しないように */
export const MILESTONE_XP_MAX = 150;
export const MILESTONE_XP_DAILY_CAP = 3;
export const GOAL_ACHIEVED_XP = 500;

export function toggleMilestone(s: AppState, id: string, now = new Date()): AppState {
  const m = s.milestones.find((x) => x.id === id);
  if (!m) return s;
  if (m.done) {
    // 取り消し：付与したXPも戻す
    return {
      ...updateMilestone(s, id, { done: false, doneAt: null }, now),
      xpLogs: s.xpLogs.filter((x) => x.key !== `milestone:${id}`),
    };
  }
  let st = updateMilestone(s, id, { done: true, doneAt: now.toISOString() }, now);
  const today = toDay(now);
  const todayCount = st.xpLogs.filter((x) => x.key.startsWith("milestone:") && toDay(new Date(x.at)) === today).length;
  if (todayCount < MILESTONE_XP_DAILY_CAP) {
    const amount = clamp(Math.round(m.xp), 0, MILESTONE_XP_MAX);
    st = { ...st, xpLogs: awardXp(st.xpLogs, `milestone:${id}`, amount, `マイルストーン達成：${m.title}`, now).logs };
  }
  return st;
}

/** 目標の状態変更。達成時はXPを1回だけ付与 */
export function setGoalStatus(s: AppState, id: string, status: GoalStatus, now = new Date()): AppState {
  let st = updateGoal(s, id, { status }, now);
  const g = st.goals.find((x) => x.id === id);
  if (status === "achieved" && g) {
    st = { ...st, xpLogs: awardXp(st.xpLogs, `goal:${id}`, GOAL_ACHIEVED_XP, `目標達成：${g.title}`, now).logs };
  }
  return st;
}

// ---------------- KPI（先行指標・結果指標） ----------------

export type MetricInput = Omit<GoalMetric, "id" | "goalId" | "current"> & { current?: number };

export function addMetric(s: AppState, goalId: string, input: MetricInput, now = new Date()): AppState {
  if (!input.name.trim()) throw new Error("指標名は必須です");
  if (input.start === input.target) throw new Error("開始値と目標値が同じです");
  const m: GoalMetric = { ...input, name: input.name.trim(), current: input.current ?? input.start, id: uid(), goalId };
  return recordProgress({ ...s, metrics: [...s.metrics, m] }, goalId, now);
}

export function logMetric(s: AppState, metricId: string, value: number, now = new Date()): AppState {
  const m = s.metrics.find((x) => x.id === metricId);
  if (!m || !Number.isFinite(value)) return s;
  return recordProgress(
    {
      ...s,
      metrics: s.metrics.map((x) => (x.id === metricId ? { ...x, current: value } : x)),
      metricLogs: [...s.metricLogs, { id: uid(), metricId, value, at: now.toISOString() }],
    },
    m.goalId,
    now,
  );
}

export function deleteMetric(s: AppState, id: string, now = new Date()): AppState {
  const m = s.metrics.find((x) => x.id === id);
  if (!m) return s;
  return recordProgress(
    { ...s, metrics: s.metrics.filter((x) => x.id !== id), metricLogs: s.metricLogs.filter((l) => l.metricId !== id) },
    m.goalId,
    now,
  );
}

export function metricProgress(m: GoalMetric): number {
  if (m.target === m.start) return 0;
  return clamp((m.current - m.start) / (m.target - m.start), 0, 1);
}

// ---------------- 進捗 ----------------

export type ProgressBasis = "milestones" | "metrics" | "milestones+metrics" | "children" | "tasks" | "manual" | "none";

/**
 * 目標の進捗率（0〜1）。
 * マイルストーン（重要度で重み付け）と結果指標を優先し、どちらも無ければ子目標→紐づくタスク→手動入力の順で使う。
 */
export function goalProgress(s: AppState, id: string, seen = new Set<string>()): { value: number; basis: ProgressBasis } {
  const g = s.goals.find((x) => x.id === id);
  if (!g || seen.has(id)) return { value: 0, basis: "none" };
  seen.add(id);
  if (g.status === "achieved") return { value: 1, basis: "manual" };

  const ms = s.milestones.filter((m) => m.goalId === id);
  const lag = s.metrics.filter((m) => m.goalId === id && m.kind === "lag");
  const msTotal = ms.reduce((a, m) => a + m.weight, 0);
  const msValue = msTotal > 0 ? ms.filter((m) => m.done).reduce((a, m) => a + m.weight, 0) / msTotal : null;
  const lagValue = lag.length > 0 ? lag.reduce((a, m) => a + metricProgress(m), 0) / lag.length : null;

  if (msValue !== null && lagValue !== null) return { value: (msValue + lagValue) / 2, basis: "milestones+metrics" };
  if (msValue !== null) return { value: msValue, basis: "milestones" };
  if (lagValue !== null) return { value: lagValue, basis: "metrics" };

  const kids = childrenOf(s, id).filter((c) => c.status !== "withdrawn");
  if (kids.length > 0) {
    const v = kids.reduce((a, c) => a + goalProgress(s, c.id, seen).value, 0) / kids.length;
    return { value: v, basis: "children" };
  }
  if (g.manualProgress !== null) return { value: clamp(g.manualProgress / 100, 0, 1), basis: "manual" };
  const tasks = s.tasks.filter((t) => t.goalId === id && t.status !== "cancelled");
  if (tasks.length > 0) {
    const done = tasks.filter((t) => t.status === "done").length + 0.5 * tasks.filter((t) => t.status === "minimum_done").length;
    return { value: done / tasks.length, basis: "tasks" };
  }
  return { value: 0, basis: "none" };
}

export const BASIS_LABEL: Record<ProgressBasis, string> = {
  milestones: "マイルストーン（重要度で重み付け）",
  metrics: "結果指標",
  "milestones+metrics": "マイルストーンと結果指標の平均",
  children: "子目標の平均",
  tasks: "紐づくタスクの完了状況",
  manual: "手動入力",
  none: "測定基準なし",
};

/** 進捗の推移を記録（予測に使う）。値が変わったときだけ追加する */
export function recordProgress(s: AppState, goalId: string, now = new Date()): AppState {
  if (!s.goals.some((g) => g.id === goalId)) return s;
  const value = goalProgress(s, goalId).value;
  const last = [...s.progressLogs].reverse().find((l) => l.goalId === goalId);
  let st = s;
  if (!last || Math.abs(last.progress - value) > 1e-9) {
    st = { ...s, progressLogs: [...s.progressLogs, { goalId, at: now.toISOString(), progress: value }] };
  }
  const parent = s.goals.find((g) => g.id === goalId)?.parentId;
  return parent ? recordProgress(st, parent, now) : st;
}

/**
 * すべての目標について、進捗が前回記録から変わっていれば記録する。
 * タスク完了など目標以外の操作による進捗の変化を予測に反映するため、状態更新のたびに呼ぶ。
 */
export function syncAllProgress(s: AppState, now = new Date()): AppState {
  if (s.goals.length === 0) return s;
  const lastByGoal = new Map<string, number>();
  for (const l of s.progressLogs) lastByGoal.set(l.goalId, l.progress);
  const added: AppState["progressLogs"] = [];
  for (const g of s.goals) {
    const v = goalProgress(s, g.id).value;
    const last = lastByGoal.get(g.id);
    if (last === undefined || Math.abs(last - v) > 1e-9) added.push({ goalId: g.id, at: now.toISOString(), progress: v });
  }
  return added.length ? { ...s, progressLogs: [...s.progressLogs, ...added] } : s;
}

/** 計画上の進捗（0〜1）。日付のあるマイルストーンがあればその予定、無ければ開始〜期限の線形 */
export function plannedProgress(s: AppState, id: string, now = new Date()): number | null {
  const g = s.goals.find((x) => x.id === id);
  if (!g || !g.dueDate) return null;
  const today = toDay(now);
  const ms = s.milestones.filter((m) => m.goalId === id && m.dueDate);
  if (ms.length > 0) {
    const total = ms.reduce((a, m) => a + m.weight, 0);
    return ms.filter((m) => m.dueDate! <= today).reduce((a, m) => a + m.weight, 0) / total;
  }
  const start = g.startDate ?? toDay(new Date(g.createdAt));
  const span = daysBetween(start, g.dueDate);
  if (span <= 0) return today >= g.dueDate ? 1 : 0;
  return clamp(daysBetween(start, today) / span, 0, 1);
}

export type Health = "ahead" | "on_track" | "behind" | "overdue" | "unknown" | "done";

export function goalHealth(s: AppState, id: string, now = new Date()): Health {
  const g = s.goals.find((x) => x.id === id);
  if (!g) return "unknown";
  if (g.status === "achieved") return "done";
  const actual = goalProgress(s, id);
  if (g.dueDate && toDay(now) > g.dueDate && actual.value < 1) return "overdue";
  const planned = plannedProgress(s, id, now);
  if (planned === null || actual.basis === "none") return "unknown";
  const gap = actual.value - planned;
  if (gap >= 0.1) return "ahead";
  if (gap <= -0.1) return "behind";
  return "on_track";
}

export const HEALTH_LABEL: Record<Health, string> = {
  ahead: "前倒し",
  on_track: "計画どおり",
  behind: "遅れ気味",
  overdue: "期限超過",
  unknown: "判定不可",
  done: "達成",
};

// ---------------- 達成予測 ----------------

export interface Forecast {
  progress: number;
  planned: number | null;
  gap: number | null;
  remaining: number;
  daysLeft: number | null;
  pacePerWeek: number | null; // 進捗率/週（0〜1）
  requiredPacePerWeek: number | null;
  projectedDate: string | null;
  delayDays: number | null;
  confidence: "insufficient" | "low" | "medium";
  dataPoints: number;
  scenarios: { label: string; projectedDate: string | null; note: string }[];
}

/**
 * 実績の推移から達成日を推定する。保証ではなく推定値。
 * データ点が2未満、または観測期間が7日未満のときは予測しない（insufficient）。
 */
export function forecastGoal(s: AppState, id: string, now = new Date()): Forecast {
  const g = s.goals.find((x) => x.id === id);
  const progress = goalProgress(s, id).value;
  const planned = plannedProgress(s, id, now);
  const today = toDay(now);
  const daysLeft = g?.dueDate ? daysBetween(today, g.dueDate) : null;
  const remaining = 1 - progress;

  const since = now.getTime() - 90 * DAY;
  const logs = s.progressLogs.filter((l) => l.goalId === id && new Date(l.at).getTime() >= since);
  const first = logs[0];
  const spanDays = first ? (now.getTime() - new Date(first.at).getTime()) / DAY : 0;
  let pacePerDay: number | null = null;
  let confidence: Forecast["confidence"] = "insufficient";
  if (logs.length >= 2 && spanDays >= 7) {
    pacePerDay = Math.max(0, (progress - first.progress) / spanDays);
    confidence = logs.length >= 6 && spanDays >= 28 ? "medium" : "low";
  }

  const project = (pace: number | null, rem: number): string | null => {
    if (rem <= 0) return today;
    if (pace === null || pace <= 0) return null;
    return addDays(today, Math.ceil(rem / pace));
  };
  const projectedDate = project(pacePerDay, remaining);
  const requiredPacePerWeek = daysLeft !== null && daysLeft > 0 ? (remaining / daysLeft) * 7 : null;

  const scenarios: Forecast["scenarios"] = [
    { label: "現在のペースを維持", projectedDate, note: "" },
    { label: "作業時間を25%増やす", projectedDate: project(pacePerDay && pacePerDay * 1.25, remaining), note: "時間を増やせる場合（健康・休息を削らない範囲で）" },
    { label: "作業効率を15%改善", projectedDate: project(pacePerDay && pacePerDay * 1.15, remaining), note: "教材・方法の見直しなど" },
    { label: "目標範囲を20%縮小", projectedDate: project(pacePerDay, remaining * 0.8), note: "優先度の低い範囲を削る" },
  ];
  if (g?.dueDate && requiredPacePerWeek !== null) {
    scenarios.push({
      label: "期限を30日延長",
      projectedDate,
      note: `必要ペースは週${((remaining / (daysLeft! + 30)) * 700).toFixed(1)}%に下がる`,
    });
  }

  return {
    progress,
    planned,
    gap: planned === null ? null : progress - planned,
    remaining,
    daysLeft,
    pacePerWeek: pacePerDay === null ? null : pacePerDay * 7,
    requiredPacePerWeek,
    projectedDate,
    delayDays: projectedDate && g?.dueDate ? daysBetween(g.dueDate, projectedDate) : null,
    confidence,
    dataPoints: logs.length,
    scenarios,
  };
}

// ---------------- 優先度 ----------------

export const GOAL_FACTOR_LABEL: Record<keyof Goal["factors"], string> = {
  longTermImpact: "人生への長期的影響",
  valueFit: "価値観との一致",
  urgency: "緊急度",
  benefit: "達成による利益",
  ripple: "他の目標への波及効果",
  resourceLightness: "必要リソースの少なさ",
  feasibility: "現在の実行可能性",
  opportunityLoss: "やらない場合の機会損失",
};

const FACTOR_WEIGHTS: Record<keyof Goal["factors"], number> = {
  longTermImpact: 0.2,
  valueFit: 0.2,
  urgency: 0.1,
  benefit: 0.15,
  ripple: 0.1,
  resourceLightness: 0.05,
  feasibility: 0.1,
  opportunityLoss: 0.1,
};

/** 参考値（0〜100）。最終判断はユーザー */
export function goalPriority(g: Goal): number {
  return (Object.keys(FACTOR_WEIGHTS) as (keyof Goal["factors"])[]).reduce((a, k) => a + FACTOR_WEIGHTS[k] * g.factors[k], 0);
}

// ---------------- SMART チェック ----------------

export function smartCheck(s: AppState, g: Goal) {
  const hasMetric = s.metrics.some((m) => m.goalId === g.id);
  return [
    { key: "S", label: "具体的（Specific）", ok: g.successCriteria.trim().length >= 5, hint: "達成条件を「何が・どうなったら達成か」で書く" },
    { key: "M", label: "測定可能（Measurable）", ok: hasMetric || s.milestones.some((m) => m.goalId === g.id), hint: "KPI かマイルストーンを1つ以上登録する" },
    { key: "A", label: "達成可能性（Achievable）", ok: g.currentState.trim().length > 0 && g.weeklyHours !== null, hint: "現在地と、週に使える時間を入力する" },
    { key: "R", label: "価値観との関連（Relevant）", ok: g.valueIds.length > 0 || g.why.trim().length > 0, hint: "関連する価値観か、達成したい理由を入力する" },
    { key: "T", label: "期限（Time-bound）", ok: !!g.dueDate, hint: "達成予定日を設定する" },
  ];
}

// ---------------- WOOP → if-then ルール ----------------

/** WOOP を保存し、Plan を既存の if-then ルールとして登録（既に連携済みなら更新はしない） */
export function saveWoop(
  s: AppState,
  goalId: string,
  woop: { wish: string; outcome: string; obstacle: string; ifText: string; thenText: string },
  createRule: boolean,
  now = new Date(),
): AppState {
  const g = s.goals.find((x) => x.id === goalId);
  if (!g) return s;
  let st = s;
  let ruleId = g.woop?.ruleId ?? null;
  if (createRule && woop.ifText.trim() && woop.thenText.trim() && !ruleId) {
    st = addRule(st, { ifText: woop.ifText, thenText: woop.thenText, trigger: "emotion" }, now);
    ruleId = st.rules[st.rules.length - 1].id;
  }
  const plan = woop.ifText.trim() || woop.thenText.trim() ? `もし${woop.ifText}なら、${woop.thenText}` : "";
  return updateGoal(st, goalId, { woop: { wish: woop.wish, outcome: woop.outcome, obstacle: woop.obstacle, plan, ruleId } }, now);
}

// ---------------- リスク ----------------

export type RiskInput = Omit<Risk, "id" | "goalId" | "ruleId">;

export function addRisk(s: AppState, goalId: string, input: RiskInput, withRule: { ifText: string; thenText: string } | null, now = new Date()): AppState {
  if (!input.title.trim()) throw new Error("リスク名は必須です");
  let st = s;
  let ruleId: string | null = null;
  if (withRule && withRule.ifText.trim() && withRule.thenText.trim()) {
    st = addRule(st, { ifText: withRule.ifText, thenText: withRule.thenText, trigger: "other" }, now);
    ruleId = st.rules[st.rules.length - 1].id;
  }
  return { ...st, risks: [...st.risks, { ...input, title: input.title.trim(), id: uid(), goalId, ruleId }] };
}

export function deleteRisk(s: AppState, id: string): AppState {
  return { ...s, risks: s.risks.filter((r) => r.id !== id) };
}

/** プレモーテムで検討する典型的な失敗原因（要件 13.1 の例） */
export const PREMORTEM_PROMPTS = [
  "必要な時間が確保できなかった",
  "途中でモチベーションが下がった",
  "他の目標や予定に時間を奪われた",
  "体調を崩した",
  "計画が非現実的だった",
  "必要な資金が足りなかった",
  "前提知識・スキルが足りなかった",
];

// ---------------- 戦略比較 ----------------

const neutralScores = (): Record<CriterionKey, number> => ({ speed: 3, timeLoad: 3, cost: 3, difficulty: 3, risk: 3, valueFit: 3, sideEffects: 3 });

export function addStrategy(s: AppState, goalId: string, input: Partial<Omit<Strategy, "id" | "goalId">> & { name: string }): AppState {
  if (!input.name.trim()) throw new Error("戦略名は必須です");
  const st: Strategy = {
    kind: "custom",
    months: null,
    hoursPerWeek: null,
    cost: null,
    pros: "",
    cons: "",
    risks: "",
    scores: neutralScores(),
    selected: false,
    ...input,
    name: input.name.trim(),
    id: uid(),
    goalId,
  };
  return { ...s, strategies: [...s.strategies, st] };
}

export function updateStrategy(s: AppState, id: string, patch: Partial<Strategy>): AppState {
  return { ...s, strategies: s.strategies.map((x) => (x.id === id ? { ...x, ...patch, id, goalId: x.goalId } : x)) };
}

export function deleteStrategy(s: AppState, id: string): AppState {
  return { ...s, strategies: s.strategies.filter((x) => x.id !== id) };
}

/** 戦略の採用はユーザーが行う。採用時は履歴に残す */
export function selectStrategy(s: AppState, id: string, now = new Date()): AppState {
  const target = s.strategies.find((x) => x.id === id);
  if (!target) return s;
  const st = snapshotPlan(s, target.goalId, `戦略「${target.name}」を採用`, now);
  return {
    ...st,
    strategies: st.strategies.map((x) => (x.goalId === target.goalId ? { ...x, selected: x.id === id } : x)),
  };
}

/** 意思決定マトリクスの加重スコア（0〜100） */
export function strategyScore(st: Strategy, weights: Record<CriterionKey, number>): number {
  const wsum = CRITERIA.reduce((a, c) => a + Math.max(0, weights[c.key] ?? 0), 0);
  if (wsum === 0) return 0;
  const raw = CRITERIA.reduce((a, c) => a + Math.max(0, weights[c.key] ?? 0) * clamp(st.scores[c.key], 1, 5), 0) / wsum;
  return ((raw - 1) / 4) * 100;
}

/**
 * 基準となる標準プランから、比較用の5つのシナリオを作る（ルールベース）。
 * 成功確率は根拠がないため出さない。スコアは初期値であり、ユーザーが調整する前提。
 */
export function strategyTemplates(base: { months: number; hoursPerWeek: number; cost: number }): Omit<Strategy, "id" | "goalId" | "selected">[] {
  const mk = (
    kind: Strategy["kind"],
    name: string,
    months: number,
    hours: number,
    cost: number,
    pros: string,
    cons: string,
    scores: Partial<Record<CriterionKey, number>>,
  ) => ({
    kind,
    name,
    months: Math.max(1, Math.round(months)),
    hoursPerWeek: Math.round(hours * 10) / 10,
    cost: Math.round(cost),
    pros,
    cons,
    risks: "",
    scores: { ...neutralScores(), ...scores },
  });
  const { months, hoursPerWeek: h, cost } = base;
  return [
    mk("fastest", "最速プラン", months * 0.7, h * 1.5, cost * 1.3, "早く達成でき、機会損失が小さい", "時間負担が大きく、他の目標や休息を圧迫しやすい", { speed: 5, timeLoad: 1, cost: 2, sideEffects: 2 }),
    mk("standard", "標準プラン", months, h, cost, "バランスが良い", "特徴が少ない", {}),
    mk("low_load", "低負荷プラン", months * 1.5, h * 0.6, cost, "継続しやすく、体調を崩しにくい", "達成が遅れ、途中で状況が変わる可能性", { speed: 2, timeLoad: 5, sideEffects: 4 }),
    mk("low_budget", "低予算プラン", months * 1.2, h * 1.1, cost * 0.4, "費用を抑えられる", "独学比率が上がり、方法の試行錯誤が増える", { cost: 5, difficulty: 2 }),
    mk("low_risk", "リスク低減プラン", months * 1.2, h, cost * 1.1, "予備時間と代替策を確保できる", "全体期間がやや長い", { risk: 5, speed: 2 }),
  ];
}

// ---------------- 逆算計画（ルールベース） ----------------

export interface PlanDraftMilestone {
  key: string;
  title: string;
  startDate: string;
  dueDate: string;
  hours: number;
  weight: number;
  criteria: string;
}

export interface PlanDraftTask {
  key: string;
  milestoneKey: string;
  title: string;
  plannedStart: string; // YYYY-MM-DD
  estimateMin: number;
  firstAction: string;
  minimum: string;
}

export interface PlanDraft {
  milestones: PlanDraftMilestone[];
  tasks: PlanDraftTask[];
  totalHours: number;
  availableHours: number;
  weeks: number;
  warnings: string[];
}

export const DEFAULT_PHASES = ["現状把握・情報収集", "基礎づくり", "実践・演習", "弱点の補強", "仕上げ・達成確認"];

export const PHASE_TEMPLATES: Record<string, string[]> = {
  資格取得: ["試験制度・必要科目の確認", "教材の選定", "基礎知識の習得", "科目別の学習", "問題演習", "過去問演習", "弱点分析", "模擬試験", "最終調整"],
  学業: ["範囲・評価方法の確認", "基礎の理解", "演習", "復習・弱点補強", "最終確認"],
  スキル: ["目標レベルと現状の確認", "基礎の習得", "小さな制作・実践", "フィードバックと改善", "成果物の完成"],
  健康: ["現状の測定", "習慣の土台づくり", "負荷を段階的に上げる", "維持と調整"],
  身体能力: ["現状の測定", "基礎トレーニング", "段階的な負荷向上", "測定と調整"],
  資産形成: ["家計と現状資産の把握", "積立・運用ルールの決定", "積立の継続", "定期的な見直し"],
  経済的自立: ["支出と収入の把握", "目標額の定義", "収入・貯蓄の仕組みづくり", "継続と見直し"],
  キャリア: ["自己分析・情報収集", "必要スキルの洗い出し", "スキル習得・実績づくり", "応募・行動", "振り返り"],
};

export interface PlanInput {
  startDate: string;
  dueDate: string;
  phases: string[];
  weeklyHours: number;
  totalHours: number | null; // 必要な総作業量（不明なら null）
  restDaysPerWeek: number; // 休息日
  bufferRatio: number; // 予備期間の割合
  nearTermWeeks: number; // 詳細タスクを作る直近週数（ローリングウェーブ）
}

/**
 * 期限から逆算してマイルストーンと直近のタスク案を作る。
 * - 予備期間（buffer）を最後に確保し、残りを各フェーズに均等配分
 * - 詳細タスクは直近 nearTermWeeks 週分だけ（遠い将来は概要に留める）
 * - 必要総作業量が利用可能時間を超える場合は警告（自動で期限は変えない）
 */
export function generateBackwardPlan(input: PlanInput): PlanDraft {
  const warnings: string[] = [];
  const phases = input.phases.map((p) => p.trim()).filter(Boolean);
  const totalDays = daysBetween(input.startDate, input.dueDate);
  if (phases.length === 0) return { milestones: [], tasks: [], totalHours: 0, availableHours: 0, weeks: 0, warnings: ["フェーズを1つ以上入力してください"] };
  if (totalDays < phases.length) {
    return { milestones: [], tasks: [], totalHours: 0, availableHours: 0, weeks: 0, warnings: ["期間が短すぎます。開始日と期限、またはフェーズ数を見直してください"] };
  }

  const weeks = totalDays / 7;
  const workDaysRatio = clamp((7 - input.restDaysPerWeek) / 7, 0.1, 1);
  const availableHours = Math.round(weeks * input.weeklyHours);
  const buffer = clamp(input.bufferRatio, 0, 0.4);
  const planDays = Math.max(phases.length, Math.floor(totalDays * (1 - buffer)));
  const per = planDays / phases.length;
  const totalHours = input.totalHours ?? Math.round(availableHours * (1 - buffer));
  const hoursPer = totalHours / phases.length;

  if (input.totalHours !== null && input.totalHours > availableHours * (1 - buffer)) {
    const need = input.totalHours / ((weeks * (1 - buffer)) || 1);
    warnings.push(
      `必要な作業量 ${input.totalHours}時間 に対し、予備期間を除いた利用可能時間は約${Math.round(availableHours * (1 - buffer))}時間です。週${need.toFixed(1)}時間が必要になります。期限の延長・範囲の縮小・週の時間配分の見直しを検討してください。`,
    );
  }
  if (input.weeklyHours / (7 * workDaysRatio) > 6) {
    warnings.push("1日あたりの作業時間が6時間を超えます。休息・睡眠を削らない計画にしてください。");
  }

  const milestones: PlanDraftMilestone[] = phases.map((title, i) => {
    const start = addDays(input.startDate, Math.round(per * i));
    const due = i === phases.length - 1 ? addDays(input.startDate, planDays) : addDays(input.startDate, Math.round(per * (i + 1)) - 1);
    return { key: `m${i}`, title, startDate: start, dueDate: due, hours: Math.round(hoursPer), weight: 3, criteria: `「${title}」の完了を確認できる状態` };
  });

  // 直近の詳細タスク（ローリングウェーブ）
  const tasks: PlanDraftTask[] = [];
  const nearEnd = addDays(input.startDate, input.nearTermWeeks * 7);
  const sessionsPerWeek = Math.max(1, 7 - input.restDaysPerWeek);
  const minutesPerSession = clamp(Math.round((input.weeklyHours * 60) / sessionsPerWeek / 5) * 5, 15, 240);
  let d = input.startDate;
  let n = 0;
  while (d < nearEnd && d <= input.dueDate && n < 30) {
    const dow = parseDay(d).getDay();
    // 休息日は週末側から割り当てる
    const isRest = input.restDaysPerWeek > 0 && (dow === 0 || (input.restDaysPerWeek > 1 && dow === 6) || (input.restDaysPerWeek > 2 && dow === 3));
    if (!isRest) {
      const m = milestones.find((x) => x.startDate <= d && d <= x.dueDate) ?? milestones[0];
      const session = tasks.filter((t) => t.milestoneKey === m.key).length + 1;
      tasks.push({
        key: `t${n}`,
        milestoneKey: m.key,
        title: `${m.title}：${session}回目（${minutesPerSession}分）`,
        plannedStart: d,
        estimateMin: minutesPerSession,
        firstAction: "必要な教材・ファイルを開く",
        minimum: "5分だけ取り組む",
      });
      n++;
    }
    d = addDays(d, 1);
  }

  return { milestones, tasks, totalHours, availableHours, weeks: Math.round(weeks * 10) / 10, warnings };
}

/** 承認された計画案を登録する。既存の計画は履歴に保存してから追加する（既存マイルストーンは消さない） */
export function applyPlanDraft(s: AppState, goalId: string, draft: PlanDraft, opts: { setDueDate?: string; setWeeklyHours?: number } = {}, now = new Date()): AppState {
  if (!s.goals.some((g) => g.id === goalId)) return s;
  let st = snapshotPlan(s, goalId, "逆算計画を承認して反映", now);
  const keyToId = new Map<string, string>();
  for (const m of draft.milestones) {
    st = addMilestone(st, goalId, { title: m.title, startDate: m.startDate, dueDate: m.dueDate, criteria: m.criteria, weight: m.weight }, now);
    keyToId.set(m.key, st.milestones[st.milestones.length - 1].id);
  }
  // 順番に依存関係を張る
  const ids = draft.milestones.map((m) => keyToId.get(m.key)!);
  st = { ...st, milestones: st.milestones.map((m) => {
    const i = ids.indexOf(m.id);
    return i > 0 ? { ...m, dependsOn: [ids[i - 1]] } : m;
  }) };
  for (const t of draft.tasks) {
    const plannedStart = parseDay(t.plannedStart);
    plannedStart.setHours(19, 0, 0, 0);
    st = addTask(
      st,
      {
        title: t.title,
        goalId,
        milestoneId: keyToId.get(t.milestoneKey) ?? null,
        plannedStart: plannedStart.toISOString(),
        estimateMin: t.estimateMin,
        firstAction: t.firstAction,
        goals: { minimum: t.minimum, normal: t.title, stretch: "余裕があれば次の内容に進む" },
      },
      now,
    );
  }
  const patch: Partial<Goal> = {};
  if (opts.setDueDate) patch.dueDate = opts.setDueDate;
  if (opts.setWeeklyHours !== undefined) patch.weeklyHours = opts.setWeeklyHours;
  const g = st.goals.find((x) => x.id === goalId)!;
  if (g.status === "idea" || g.status === "planning") patch.status = "active";
  return updateGoal(st, goalId, patch, now);
}

// ---------------- リソース ----------------

export interface ResourceSummary {
  available: number; // 予備を除いた週の利用可能時間
  allocated: number;
  overloaded: boolean;
  byGoal: { goal: Goal; planned: number; actualThisWeek: number }[];
  activeMainCount: number;
  budget: { goal: Goal; budget: number; spent: number; remaining: number }[];
}

function weekStart(now: Date): Date {
  const x = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** 目標別の実績時間（集中セッションのうち、目標に紐づくタスクのもの） */
export function actualHoursByGoal(s: AppState, from: Date, to: Date, now = new Date()): Map<string, number> {
  const taskGoal = new Map(s.tasks.map((t) => [t.id, t.goalId]));
  const out = new Map<string, number>();
  for (const f of s.focusSessions) {
    const st = new Date(f.startedAt);
    if (st < from || st >= to || !f.taskId) continue;
    const gid = taskGoal.get(f.taskId);
    if (!gid) continue;
    const end = f.endedAt ? new Date(f.endedAt) : f.pausedAt ? new Date(f.pausedAt) : now;
    const h = Math.max(0, end.getTime() - st.getTime() - f.pausedMs) / 3_600_000;
    out.set(gid, (out.get(gid) ?? 0) + h);
  }
  return out;
}

export function resourceSummary(s: AppState, now = new Date()): ResourceSummary {
  const p = s.settings.planning;
  const available = p.weeklyAvailableHours * (1 - clamp(p.reserveRatio, 0, 0.5));
  const working = s.goals.filter((g) => WORKING_STATUSES.includes(g.status) && (g.focus === "main" || g.focus === "sub" || g.focus === "maintain"));
  const ws = weekStart(now);
  const actual = actualHoursByGoal(s, ws, new Date(ws.getTime() + 7 * DAY), now);
  const byGoal = working.map((goal) => ({ goal, planned: goal.weeklyHours ?? 0, actualThisWeek: actual.get(goal.id) ?? 0 }));
  const allocated = byGoal.reduce((a, x) => a + x.planned, 0);
  return {
    available,
    allocated,
    overloaded: allocated > available,
    byGoal,
    activeMainCount: working.filter((g) => g.focus === "main").length,
    budget: s.goals
      .filter((g) => g.budget !== null && OPEN_STATUSES.includes(g.status))
      .map((goal) => ({ goal, budget: goal.budget!, spent: goal.spent, remaining: goal.budget! - goal.spent })),
  };
}

// ---------------- 診断（ルールベースの戦略参謀） ----------------

export interface Diagnosis {
  level: "warn" | "info";
  goalId: string | null;
  kind: "resource" | "plan" | "psych" | "structure";
  message: string;
  suggestions: string[];
}

/**
 * 計画の矛盾・過密・遅れ・前提不足を検出する。迎合せず具体的に指摘する。
 * 遅れについては「心理的阻害」「計画の問題」「リソース不足」を区別して示す。
 */
export function diagnose(s: AppState, now = new Date()): Diagnosis[] {
  const out: Diagnosis[] = [];
  const today = toDay(now);
  const res = resourceSummary(s, now);

  if (res.overloaded) {
    out.push({
      level: "warn",
      goalId: null,
      kind: "resource",
      message: `進行中の目標に配分した時間が週${res.allocated.toFixed(1)}時間で、予備を除いた利用可能時間（週${res.available.toFixed(1)}時間）を超えています。`,
      suggestions: ["最優先の目標に集中し、他の目標の開始時期を後ろにずらす", "一部の目標を「保留」「将来実行」に切り替える", "目標範囲を縮小する、または期限を延長する"],
    });
  }
  if (res.activeMainCount > 3) {
    out.push({
      level: "warn",
      goalId: null,
      kind: "structure",
      message: `メイン目標が${res.activeMainCount}個あります。同時に重点的に進める目標は1〜3個に絞ることをおすすめします。`,
      suggestions: ["メイン目標を絞り、残りをサブ・維持・保留に分ける"],
    });
  }

  for (const g of s.goals.filter((x) => OPEN_STATUSES.includes(x.status))) {
    const name = `「${g.title}」`;
    const smart = smartCheck(s, g).filter((c) => !c.ok);
    if (smart.length >= 3) {
      out.push({ level: "info", goalId: g.id, kind: "plan", message: `${name}は前提情報が不足しています（${smart.map((c) => c.key).join("・")}が未設定）。`, suggestions: smart.map((c) => c.hint) });
    }
    const parent = g.parentId ? s.goals.find((x) => x.id === g.parentId) : null;
    if (parent?.dueDate && g.dueDate && g.dueDate > parent.dueDate) {
      out.push({ level: "warn", goalId: g.id, kind: "structure", message: `${name}の期限（${g.dueDate}）が親目標「${parent.title}」の期限（${parent.dueDate}）より後になっています。`, suggestions: ["子目標の期限を前倒しするか、親目標の期限を見直す"] });
    }
    for (const depId of g.dependsOn) {
      const dep = s.goals.find((x) => x.id === depId);
      if (dep?.dueDate && g.startDate && dep.dueDate > g.startDate && dep.status !== "achieved") {
        out.push({ level: "warn", goalId: g.id, kind: "structure", message: `${name}は「${dep.title}」に依存していますが、依存先の期限（${dep.dueDate}）が開始予定日（${g.startDate}）より後です。`, suggestions: ["開始時期を後ろにずらす", "依存関係を見直す"] });
      }
    }
    const ms = s.milestones.filter((m) => m.goalId === g.id);
    const overdueMs = ms.filter((m) => !m.done && m.dueDate && m.dueDate < today);
    if (overdueMs.length > 0) {
      out.push({ level: "warn", goalId: g.id, kind: "plan", message: `${name}のマイルストーン${overdueMs.length}件が期限を過ぎています（${overdueMs.map((m) => m.title).join("、")}）。`, suggestions: ["マイルストーンの期限を引き直す（変更は履歴に残ります）", "範囲を縮小する", "プランBに切り替える"] });
    }
    const health = goalHealth(s, g.id, now);
    if (health === "behind" || health === "overdue") {
      // 遅れの原因を区別する
      const linked = s.tasks.filter((t) => t.goalId === g.id);
      const recent = linked.filter((t) => t.plannedStart && new Date(t.plannedStart).getTime() >= now.getTime() - 14 * DAY && new Date(t.plannedStart) <= now);
      const startedRatio = recent.length > 0 ? recent.filter((t) => t.firstStartedAt).length / recent.length : null;
      const stuckCount = s.interventions.filter((i) => i.taskId && linked.some((t) => t.id === i.taskId)).length;
      const actualH = actualHoursByGoal(s, new Date(now.getTime() - 14 * DAY), now, now).get(g.id) ?? 0;
      const plannedH = (g.weeklyHours ?? 0) * 2;
      if (startedRatio !== null && startedRatio < 0.5) {
        out.push({ level: "warn", goalId: g.id, kind: "psych", message: `${name}は遅れており、直近2週間の予定タスクの着手率が${Math.round(startedRatio * 100)}%です。作業量より「着手」に課題がありそうです${stuckCount > 0 ? `（気が進まない記録${stuckCount}件）` : ""}。`, suggestions: ["タスクを30秒アクションまで小さくする", "「行動できない」画面で阻害要因に合った方法を試す", "最低目標に切り替えて継続を優先する"] });
      } else if (plannedH > 0 && actualH < plannedH * 0.6) {
        out.push({ level: "warn", goalId: g.id, kind: "resource", message: `${name}は遅れており、直近2週間の実績時間（${actualH.toFixed(1)}時間）が配分（${plannedH.toFixed(1)}時間）を大きく下回っています。時間が確保できていない可能性があります。`, suggestions: ["固定予定を踏まえて週の配分時間を現実的な値に直す", "他の目標の優先度を下げる", "期限を延長する"] });
      } else {
        out.push({ level: "warn", goalId: g.id, kind: "plan", message: `${name}は計画より遅れています。着手や時間は確保できているなら、計画（作業量の見積もりや方法）に問題がある可能性があります。`, suggestions: ["優先度の低い範囲を削る", "学習・作業方法を変える", "マイルストーンを引き直す", "代替戦略（プランB）に切り替える"] });
      }
    }
    if (WORKING_STATUSES.includes(g.status) && !s.tasks.some((t) => t.goalId === g.id && !["done", "cancelled"].includes(t.status)) && childrenOf(s, g.id).length === 0) {
      out.push({ level: "info", goalId: g.id, kind: "plan", message: `${name}は実行中ですが、未完了のタスクがありません。計画が日々の行動に変換されていません。`, suggestions: ["逆算計画で直近のタスクを作る", "目標詳細から次の具体的なタスクを1つ追加する"] });
    }
    if (WORKING_STATUSES.includes(g.status) && !s.risks.some((r) => r.goalId === g.id) && (g.factors.longTermImpact >= 70 || g.focus === "main")) {
      out.push({ level: "info", goalId: g.id, kind: "plan", message: `${name}は重要な目標ですが、リスク・障害が登録されていません。`, suggestions: ["プレモーテム（失敗した未来の想定）でリスクを洗い出す"] });
    }
  }
  return out;
}
