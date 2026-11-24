/**
 * 状態遷移（純粋関数）。UI からはこれらを通して状態を変更する。
 * now を引数で受け取ることでテスト可能にしている。
 */
import { DEFAULT_WEIGHTS } from "./priority";
import type {
  ActionLog,
  ActionType,
  AppState,
  Blocker,
  FocusSession,
  Habit,
  IfThenRule,
  InterventionLog,
  Task,
  TaskStatus,
} from "./types";
import { localDate, uid } from "./util";
import { XP_TABLE, awardPsychWorkXp, awardXp } from "./xp";

export function emptyState(): AppState {
  return {
    version: 1,
    values: [],
    goals: [],
    milestones: [],
    metrics: [],
    metricLogs: [],
    risks: [],
    strategies: [],
    planVersions: [],
    progressLogs: [],
    reviews: [],
    tasks: [],
    actionLogs: [],
    focusSessions: [],
    interventions: [],
    habits: [],
    habitLogs: [],
    rules: [],
    ruleLogs: [],
    xpLogs: [],
    settings: {
      gamification: true,
      aiEnabled: false,
      weights: { ...DEFAULT_WEIGHTS },
      planning: { weeklyAvailableHours: 14, reserveRatio: 0.2, birthYear: null },
    },
  };
}

export type TaskInput = Partial<Omit<Task, "id" | "createdAt" | "updatedAt">> & { title: string };

export function newTask(input: TaskInput, now = new Date()): Task {
  const iso = now.toISOString();
  return {
    description: "",
    category: "",
    importance: 50,
    urgency: 50,
    valueAlignment: 50,
    longTermImpact: 50,
    feasibility: 50,
    psychLoad: 30,
    deadline: null,
    plannedStart: null,
    estimateMin: null,
    firstAction: "",
    goals: { minimum: "", normal: "", stretch: "" },
    steps: [],
    status: "todo",
    goalId: null,
    milestoneId: null,
    isMostImportant: false,
    nextAction: "",
    progressNote: "",
    firstStartedAt: null,
    ...input,
    title: input.title.trim(),
    id: uid(),
    createdAt: iso,
    updatedAt: iso,
  };
}

export function addTask(s: AppState, input: TaskInput, now = new Date()): AppState {
  if (!input.title.trim()) throw new Error("タスク名は必須です");
  let tasks = s.tasks;
  const t = newTask(input, now);
  if (t.isMostImportant) tasks = tasks.map((x) => ({ ...x, isMostImportant: false }));
  return { ...s, tasks: [...tasks, t] };
}

export function updateTask(s: AppState, id: string, patch: Partial<Task>, now = new Date()): AppState {
  if (patch.title !== undefined && !patch.title.trim()) throw new Error("タスク名は必須です");
  return {
    ...s,
    tasks: s.tasks.map((t) => {
      if (t.id === id) return { ...t, ...patch, id: t.id, updatedAt: now.toISOString() };
      if (patch.isMostImportant) return { ...t, isMostImportant: false };
      return t;
    }),
  };
}

export function deleteTask(s: AppState, id: string): AppState {
  // 行動ログは実績として残す（タスクIDは参照切れになるが、集計からは除外されない）
  return { ...s, tasks: s.tasks.filter((t) => t.id !== id) };
}

export function duplicateTask(s: AppState, id: string, now = new Date()): AppState {
  const src = s.tasks.find((t) => t.id === id);
  if (!src) return s;
  const rest: Partial<Task> = { ...src };
  delete rest.id;
  delete rest.createdAt;
  delete rest.updatedAt;
  return addTask(
    s,
    {
      ...rest,
      title: `${src.title}（コピー）`,
      status: "todo",
      firstStartedAt: null,
      isMostImportant: false,
      steps: src.steps.map((x) => ({ ...x, id: uid(), done: false })),
    },
    now,
  );
}

function log(s: AppState, taskId: string | null, type: ActionType, now: Date, note?: string): AppState {
  const entry: ActionLog = { id: uid(), taskId, type, at: now.toISOString(), ...(note ? { note } : {}) };
  return { ...s, actionLogs: [...s.actionLogs, entry] };
}

export function activeFocus(s: AppState): FocusSession | undefined {
  return s.focusSessions.find((f) => !f.endedAt);
}

function endActiveFocus(s: AppState, now: Date, interruptionReason?: string): AppState {
  const f = activeFocus(s);
  if (!f) return s;
  const pausedMs = f.pausedAt ? f.pausedMs + (now.getTime() - new Date(f.pausedAt).getTime()) : f.pausedMs;
  const interruptions = interruptionReason
    ? [...f.interruptions, { at: now.toISOString(), reason: interruptionReason }]
    : f.interruptions;
  return {
    ...s,
    focusSessions: s.focusSessions.map((x) =>
      x.id === f.id ? { ...x, endedAt: now.toISOString(), pausedAt: null, pausedMs, interruptions } : x,
    ),
  };
}

function setStatus(s: AppState, id: string, status: TaskStatus, now: Date, extra: Partial<Task> = {}): AppState {
  return updateTask(s, id, { status, ...extra }, now);
}

/**
 * 1タップ着手。最初の行動を表示し、カウントアップの集中セッションを開始する。
 * 他に実行中のタスクがあれば一時停止する（シングルタスク）。
 */
export function startTask(
  s: AppState,
  id: string,
  now = new Date(),
  opts: { mode?: FocusSession["mode"]; targetMin?: number | null } = {},
): AppState {
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return s;
  let st = s;
  for (const other of st.tasks.filter((x) => x.status === "doing" && x.id !== id)) {
    st = pauseTask(st, other.id, now);
  }
  st = endActiveFocus(st, now);

  const wasStopped = t.status === "paused" || t.status === "interrupted";
  st = log(st, id, wasStopped ? "resume" : "start", now);
  st = setStatus(st, id, "doing", now, { firstStartedAt: t.firstStartedAt ?? now.toISOString() });

  // XP：着手は「タスク×日」で1回だけ
  st = { ...st, xpLogs: awardXp(st.xpLogs, `start:${id}:${localDate(now)}`, XP_TABLE.taskStart, "タスク着手", now).logs };
  // XP：中断後の復帰は、中断イベントごとに1回だけ
  if (wasStopped) {
    const lastStop = [...s.actionLogs].reverse().find((l) => l.taskId === id && (l.type === "interrupt" || l.type === "pause"));
    if (lastStop) {
      st = { ...st, xpLogs: awardXp(st.xpLogs, `recovery:${lastStop.id}`, XP_TABLE.recovery, "中断後の復帰", now).logs };
    }
  }

  const session: FocusSession = {
    id: uid(),
    taskId: id,
    mode: opts.mode ?? "countup",
    targetMin: opts.targetMin ?? null,
    startedAt: now.toISOString(),
    endedAt: null,
    pausedAt: null,
    pausedMs: 0,
    interruptions: [],
    immersion: null,
  };
  return { ...st, focusSessions: [...st.focusSessions, session] };
}

export function pauseTask(s: AppState, id: string, now = new Date(), progress?: { note?: string; nextAction?: string }): AppState {
  let st = endActiveFocusFor(s, id, now);
  st = log(st, id, "pause", now, progress?.note);
  return setStatus(st, id, "paused", now, progressPatch(progress));
}

export function interruptTask(
  s: AppState,
  id: string,
  reason: string,
  now = new Date(),
  progress?: { note?: string; nextAction?: string },
): AppState {
  let st = endActiveFocusFor(s, id, now, reason || "理由未入力");
  st = log(st, id, "interrupt", now, reason);
  return setStatus(st, id, "interrupted", now, progressPatch(progress));
}

function progressPatch(p?: { note?: string; nextAction?: string }): Partial<Task> {
  const out: Partial<Task> = {};
  if (p?.note !== undefined) out.progressNote = p.note;
  if (p?.nextAction !== undefined) out.nextAction = p.nextAction;
  return out;
}

function endActiveFocusFor(s: AppState, taskId: string, now: Date, reason?: string): AppState {
  const f = activeFocus(s);
  return f && f.taskId === taskId ? endActiveFocus(s, now, reason) : s;
}

/** 最低目標達成：実行実績として評価するが、完了とは区別する */
export function completeMinimum(s: AppState, id: string, now = new Date()): AppState {
  let st = endActiveFocusFor(s, id, now);
  st = log(st, id, "minimum", now);
  st = setStatus(st, id, "minimum_done", now);
  return { ...st, xpLogs: awardXp(st.xpLogs, `min:${id}`, XP_TABLE.minimumDone, "最低目標達成", now).logs };
}

export function completeTask(s: AppState, id: string, now = new Date()): AppState {
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return s;
  let st = endActiveFocusFor(s, id, now);
  st = log(st, id, "complete", now);
  st = setStatus(st, id, "done", now);
  const amount = t.isMostImportant ? XP_TABLE.mostImportantDone : XP_TABLE.taskDone;
  const reason = t.isMostImportant ? "最重要タスク完了" : "タスク完了";
  return { ...st, xpLogs: awardXp(st.xpLogs, `done:${id}`, amount, reason, now).logs };
}

/** 延期・再計画・中止・休息：いずれも正当な選択として扱う（罰則なし） */
export function postponeTask(s: AppState, id: string, until: string | null, now = new Date()): AppState {
  let st = endActiveFocusFor(s, id, now);
  st = log(st, id, "postpone", now);
  return setStatus(st, id, "postponed", now, { plannedStart: until });
}

export function replanTask(s: AppState, id: string, now = new Date()): AppState {
  let st = endActiveFocusFor(s, id, now);
  st = log(st, id, "replan", now);
  return setStatus(st, id, "replan", now);
}

export function cancelTask(s: AppState, id: string, now = new Date()): AppState {
  let st = endActiveFocusFor(s, id, now);
  st = log(st, id, "cancel", now);
  return setStatus(st, id, "cancelled", now);
}

export function takeRest(s: AppState, taskId: string | null, now = new Date()): AppState {
  let st = s;
  if (taskId) {
    st = endActiveFocusFor(st, taskId, now);
    const t = st.tasks.find((x) => x.id === taskId);
    if (t?.status === "doing") st = setStatus(st, taskId, "paused", now);
  }
  return log(st, taskId, "rest", now);
}

// ---- 集中タイマー ----

export function pauseFocus(s: AppState, now = new Date()): AppState {
  const f = activeFocus(s);
  if (!f || f.pausedAt) return s;
  return { ...s, focusSessions: s.focusSessions.map((x) => (x.id === f.id ? { ...x, pausedAt: now.toISOString() } : x)) };
}

export function resumeFocus(s: AppState, now = new Date()): AppState {
  const f = activeFocus(s);
  if (!f || !f.pausedAt) return s;
  const pausedMs = f.pausedMs + (now.getTime() - new Date(f.pausedAt).getTime());
  return { ...s, focusSessions: s.focusSessions.map((x) => (x.id === f.id ? { ...x, pausedAt: null, pausedMs } : x)) };
}

export function rateLastFocus(s: AppState, sessionId: string, immersion: number): AppState {
  return { ...s, focusSessions: s.focusSessions.map((x) => (x.id === sessionId ? { ...x, immersion } : x)) };
}

export function startFreeFocus(s: AppState, mode: FocusSession["mode"], targetMin: number | null, now = new Date()): AppState {
  let st = endActiveFocus(s, now);
  const session: FocusSession = {
    id: uid(),
    taskId: null,
    mode,
    targetMin,
    startedAt: now.toISOString(),
    endedAt: null,
    pausedAt: null,
    pausedMs: 0,
    interruptions: [],
    immersion: null,
  };
  st = { ...st, focusSessions: [...st.focusSessions, session] };
  return st;
}

export function endFreeFocus(s: AppState, now = new Date()): AppState {
  return endActiveFocus(s, now);
}

// ---- 心理介入 ----

export function logIntervention(
  s: AppState,
  input: { taskId: string | null; blocker: Blocker; techniqueId: string; note?: string; outcome: InterventionLog["outcome"] },
  now = new Date(),
): AppState {
  const entry: InterventionLog = { id: uid(), note: "", ...input, at: now.toISOString() };
  return {
    ...s,
    interventions: [...s.interventions, entry],
    xpLogs: awardPsychWorkXp(s.xpLogs, entry.id, now).logs,
  };
}

// ---- 習慣 ----

export function addHabit(s: AppState, input: Omit<Habit, "id" | "createdAt" | "archived">, now = new Date()): AppState {
  if (!input.name.trim()) throw new Error("習慣名は必須です");
  const h: Habit = { ...input, name: input.name.trim(), id: uid(), createdAt: now.toISOString(), archived: false };
  return { ...s, habits: [...s.habits, h] };
}

export function archiveHabit(s: AppState, id: string): AppState {
  // 実績（ログ）は消さない
  return { ...s, habits: s.habits.map((h) => (h.id === id ? { ...h, archived: true } : h)) };
}

/** 1日1回まで記録。最低条件→通常への格上げは可能。XPは1日1回 */
export function logHabit(s: AppState, habitId: string, level: "minimum" | "normal", now = new Date()): AppState {
  const date = localDate(now);
  const existing = s.habitLogs.find((l) => l.habitId === habitId && l.date === date);
  let habitLogs = s.habitLogs;
  if (existing) {
    if (existing.level === level || existing.level === "normal") return s;
    habitLogs = habitLogs.map((l) => (l.id === existing.id ? { ...l, level } : l));
  } else {
    habitLogs = [...habitLogs, { id: uid(), habitId, date, level, at: now.toISOString() }];
  }
  return {
    ...s,
    habitLogs,
    xpLogs: awardXp(s.xpLogs, `habit:${habitId}:${date}`, XP_TABLE.habitDone, "習慣実行", now).logs,
  };
}

export function undoHabitToday(s: AppState, habitId: string, now = new Date()): AppState {
  const date = localDate(now);
  return {
    ...s,
    habitLogs: s.habitLogs.filter((l) => !(l.habitId === habitId && l.date === date)),
    xpLogs: s.xpLogs.filter((x) => x.key !== `habit:${habitId}:${date}`),
  };
}

// ---- if-then ----

export function addRule(s: AppState, input: Pick<IfThenRule, "ifText" | "thenText" | "trigger">, now = new Date()): AppState {
  if (!input.ifText.trim() || !input.thenText.trim()) throw new Error("IF と THEN の両方を入力してください");
  const r: IfThenRule = { ...input, id: uid(), active: true, createdAt: now.toISOString() };
  return { ...s, rules: [...s.rules, r] };
}

export function toggleRule(s: AppState, id: string): AppState {
  return { ...s, rules: s.rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)) };
}

export function deleteRule(s: AppState, id: string): AppState {
  return { ...s, rules: s.rules.filter((r) => r.id !== id) };
}

export function logRule(s: AppState, ruleId: string, executed: boolean, now = new Date()): AppState {
  return { ...s, ruleLogs: [...s.ruleLogs, { id: uid(), ruleId, executed, at: now.toISOString() }] };
}

export function ruleExecutionRate(s: AppState, ruleId: string): { rate: number | null; count: number } {
  const logs = s.ruleLogs.filter((l) => l.ruleId === ruleId);
  if (logs.length === 0) return { rate: null, count: 0 };
  return { rate: (logs.filter((l) => l.executed).length / logs.length) * 100, count: logs.length };
}

/** 実行率が低いルールへの改善提案（要件 10.6） */
export function ruleSuggestions(rateValue: number | null, count: number): string[] {
  if (rateValue === null || count < 3 || rateValue >= 50) return [];
  return [
    "THEN の行動をもっと小さくする（例：30秒でできることに）",
    "IF のきっかけを、毎日必ず起きる既存の習慣に変える",
    "実行する時刻や場所を変えてみる",
    "うまくいかない日の代替行動を決めておく",
  ];
}
