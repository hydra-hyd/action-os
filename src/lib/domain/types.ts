// ACTION OS ドメイン型定義（MVP / Phase 1）

export type TaskStatus =
  | "todo" // 未着手
  | "doing" // 実行中
  | "paused" // 一時停止
  | "interrupted" // 中断
  | "minimum_done" // 最低目標達成
  | "done" // 完了
  | "postponed" // 延期
  | "replan" // 再計画
  | "cancelled"; // キャンセル

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "未着手",
  doing: "実行中",
  paused: "一時停止",
  interrupted: "中断",
  minimum_done: "最低目標達成",
  done: "完了",
  postponed: "延期",
  replan: "再計画",
  cancelled: "キャンセル",
};

export interface TieredGoals {
  minimum: string; // 最低目標
  normal: string; // 通常目標
  stretch: string; // 発展目標
}

export interface Step {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  importance: number; // 0-100
  urgency: number; // 0-100
  valueAlignment: number; // 0-100 価値観との一致度
  longTermImpact: number; // 0-100
  feasibility: number; // 0-100 実行可能性
  psychLoad: number; // 0-100 心理的負担
  deadline: string | null; // ISO
  plannedStart: string | null; // ISO 行動予定時刻
  estimateMin: number | null;
  firstAction: string; // 30秒アクション
  goals: TieredGoals;
  steps: Step[];
  status: TaskStatus;
  goalId: string | null; // 関連する目標
  milestoneId: string | null; // 関連するマイルストーン
  isMostImportant: boolean; // 本日の最重要タスク
  nextAction: string; // 復帰時に表示する次の具体的行動
  progressNote: string; // 前回の進捗メモ
  firstStartedAt: string | null; // 初回着手時刻
  createdAt: string;
  updatedAt: string;
}

export type ActionType =
  | "start"
  | "pause"
  | "resume"
  | "interrupt"
  | "minimum"
  | "complete"
  | "postpone"
  | "replan"
  | "cancel"
  | "rest";

export interface ActionLog {
  id: string;
  taskId: string | null;
  type: ActionType;
  at: string;
  note?: string;
}

export interface FocusSession {
  id: string;
  taskId: string | null;
  mode: "countup" | "countdown" | "pomodoro";
  targetMin: number | null;
  startedAt: string;
  endedAt: string | null;
  pausedAt: string | null; // 一時停止中ならその時刻
  pausedMs: number; // 累積一時停止時間
  interruptions: { at: string; reason: string }[];
  immersion: number | null; // 主観的没頭度 1-5
}

export type Blocker =
  | "bother" // 面倒くさい
  | "no_motivation" // やる気がない
  | "fear_failure" // 失敗が怖い
  | "perfectionism" // 完璧にできない
  | "anxiety" // 不安が強い
  | "no_confidence" // 自信がない
  | "phone" // スマホを触りたい
  | "tired" // 疲れている
  | "meaningless" // 意味を感じない
  | "where_to_start" // 何から始めるか分からない
  | "too_many" // タスクが多すぎる
  | "bored" // 飽きている
  | "other";

export interface InterventionLog {
  id: string;
  taskId: string | null;
  blocker: Blocker;
  note: string;
  techniqueId: string;
  at: string;
  outcome: "started" | "minimum" | "rest" | "postpone" | "replan" | "none";
}

export interface Habit {
  id: string;
  name: string;
  minimum: string; // 最低実行条件
  anchor: string; // 習慣チェーン：〜の後に
  weekdays: number[]; // 0=日..6=土。空なら毎日
  createdAt: string;
  archived: boolean;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD (ローカル)
  level: "minimum" | "normal";
  at: string;
}

export interface IfThenRule {
  id: string;
  ifText: string;
  thenText: string;
  trigger: "time" | "habit" | "place" | "emotion" | "temptation" | "task" | "other";
  active: boolean;
  createdAt: string;
}

export interface IfThenLog {
  id: string;
  ruleId: string;
  at: string;
  executed: boolean;
}

export interface XpLog {
  key: string; // 冪等キー
  amount: number;
  reason: string;
  at: string;
}

export interface PriorityWeights {
  importance: number;
  urgency: number;
  valueAlignment: number;
  longTermImpact: number;
  feasibility: number;
}

export interface Settings {
  gamification: boolean;
  aiEnabled: boolean; // 外部AIへのタスク情報送信を許可
  weights: PriorityWeights;
  planning: PlanningSettings;
}

// ===================== 長期目標・戦略計画 =====================

export interface PlanningSettings {
  weeklyAvailableHours: number; // 1週間に目標へ使える時間
  reserveRatio: number; // 予備時間の割合（0〜0.5）
  birthYear: number | null; // ロードマップで年齢表示に使う（任意）
}

export interface Value {
  id: string;
  name: string;
  note: string;
  createdAt: string;
}

export type GoalHorizon = "life" | "20y" | "10y" | "5y" | "3y" | "1y" | "6m" | "3m" | "1m" | "1w" | "today" | "custom";

export type GoalStatus =
  | "idea" // 構想中
  | "planning" // 計画中
  | "active" // 実行中
  | "on_track" // 順調
  | "delayed" // 遅延
  | "needs_review" // 要見直し
  | "paused" // 一時停止
  | "achieved" // 達成
  | "withdrawn"; // 撤回

export type GoalFocus = "main" | "sub" | "maintain" | "hold" | "future" | "drop";

export interface Woop {
  wish: string;
  outcome: string;
  obstacle: string;
  plan: string; // if-then 形式の行動計画
  ruleId: string | null; // 連携した if-then ルール
}

/** 目標優先度の評価項目（0〜100） */
export interface GoalPriorityFactors {
  longTermImpact: number;
  valueFit: number;
  urgency: number;
  benefit: number;
  ripple: number; // 他の目標への波及効果
  resourceLightness: number; // 必要リソースの少なさ（多いほど低い）
  feasibility: number;
  opportunityLoss: number;
}

export interface Goal {
  id: string;
  parentId: string | null;
  title: string;
  description: string;
  category: string;
  valueIds: string[];
  why: string; // 達成したい理由
  whys: string[]; // 5回のWhy
  horizon: GoalHorizon;
  startDate: string | null; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  status: GoalStatus;
  focus: GoalFocus; // 選択と集中
  currentState: string; // 現在地
  successCriteria: string; // 達成条件
  difficulty: number; // 0-100
  factors: GoalPriorityFactors;
  weeklyHours: number | null; // この目標に配分する週あたり時間
  budget: number | null; // 必要予算（円）
  spent: number; // 使用済み（円）
  requiredSkills: string;
  prerequisites: string;
  reward: string;
  dependsOn: string[]; // 依存する目標
  woop: Woop | null;
  plans: { a: string; b: string; c: string };
  activePlan: "a" | "b" | "c";
  manualProgress: number | null; // 0-100。指標もマイルストーンも無いときに使う
  matrixWeights: Record<CriterionKey, number>;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  criteria: string; // 達成条件・成果物
  weight: number; // 重要度 1-5（進捗率の重み）
  done: boolean;
  doneAt: string | null;
  xp: number;
  reward: string;
  dependsOn: string[]; // 先行するマイルストーン
  order: number;
}

export interface GoalMetric {
  id: string;
  goalId: string;
  name: string;
  kind: "lead" | "lag"; // 先行指標 / 結果指標
  unit: string;
  start: number;
  target: number;
  current: number;
  frequency: "daily" | "weekly" | "monthly" | "once";
  method: string;
}

export interface MetricLog {
  id: string;
  metricId: string;
  value: number;
  at: string;
}

export interface Risk {
  id: string;
  goalId: string;
  title: string;
  trigger: string; // 発生条件
  likelihood: number; // 1-5（自己評価）
  impact: number; // 1-5
  prevention: string;
  response: string;
  ruleId: string | null;
}

export type CriterionKey = "speed" | "timeLoad" | "cost" | "difficulty" | "risk" | "valueFit" | "sideEffects";

export interface Strategy {
  id: string;
  goalId: string;
  name: string;
  kind: "fastest" | "standard" | "low_load" | "low_budget" | "low_risk" | "custom";
  months: number | null;
  hoursPerWeek: number | null;
  cost: number | null;
  pros: string;
  cons: string;
  risks: string;
  scores: Record<CriterionKey, number>; // 1-5（大きいほど良い）
  selected: boolean;
}

export interface PlanVersion {
  id: string;
  goalId: string;
  at: string;
  reason: string;
  snapshot: { goal: Goal; milestones: Milestone[] };
}

export interface ProgressLog {
  goalId: string;
  at: string;
  progress: number; // 0-1
}

export type ReviewKind = "daily" | "weekly" | "monthly" | "quarterly" | "annual";

export interface Review {
  id: string;
  kind: ReviewKind;
  at: string;
  answers: Record<string, string>;
  stats: Record<string, string>; // 実施時点の自動集計（記録用）
}

export interface AppState {
  version: 1;
  values: Value[];
  goals: Goal[];
  milestones: Milestone[];
  metrics: GoalMetric[];
  metricLogs: MetricLog[];
  risks: Risk[];
  strategies: Strategy[];
  planVersions: PlanVersion[];
  progressLogs: ProgressLog[];
  reviews: Review[];
  tasks: Task[];
  actionLogs: ActionLog[];
  focusSessions: FocusSession[];
  interventions: InterventionLog[];
  habits: Habit[];
  habitLogs: HabitLog[];
  rules: IfThenRule[];
  ruleLogs: IfThenLog[];
  xpLogs: XpLog[];
  settings: Settings;
}
