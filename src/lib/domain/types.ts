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
}

export interface AppState {
  version: 1;
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
