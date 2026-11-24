import type { AppState, Habit } from "./types";
import { localDate, median } from "./util";

/** 分母が0の場合は null（＝データなし）を返す（要件 21.3） */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export function formatRate(r: number | null): string {
  return r === null ? "データなし" : `${Math.round(r)}%`;
}

export interface Period {
  from: Date; // inclusive
  to: Date; // exclusive
}

const inPeriod = (iso: string | null | undefined, p: Period) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= p.from.getTime() && t < p.to.getTime();
};

/** 予定タスク＝行動予定時刻がその期間内にあるタスク（キャンセル除く） */
function plannedTasks(s: AppState, p: Period) {
  return s.tasks.filter((t) => t.status !== "cancelled" && inPeriod(t.plannedStart, p));
}

export function startRate(s: AppState, p: Period): number | null {
  const planned = plannedTasks(s, p);
  return rate(planned.filter((t) => t.firstStartedAt).length, planned.length);
}

export function completionRate(s: AppState, p: Period): number | null {
  const planned = plannedTasks(s, p);
  return rate(planned.filter((t) => t.status === "done").length, planned.length);
}

export function minimumRate(s: AppState, p: Period): number | null {
  const planned = plannedTasks(s, p);
  return rate(planned.filter((t) => t.status === "minimum_done" || t.status === "done").length, planned.length);
}

/** 着手遅延（分）の中央値：予定時刻 → 初回着手 */
export function medianStartDelayMin(s: AppState, p: Period): number | null {
  const delays = plannedTasks(s, p)
    .filter((t) => t.firstStartedAt && t.plannedStart)
    .map((t) => Math.max(0, (new Date(t.firstStartedAt!).getTime() - new Date(t.plannedStart!).getTime()) / 60000));
  return median(delays);
}

/** 復帰率 = 期間内の中断イベントのうち、その後に再開（resume/start）されたもの */
export function recoveryRate(s: AppState, p: Period): number | null {
  const interrupts = s.actionLogs.filter((l) => (l.type === "interrupt" || l.type === "pause") && inPeriod(l.at, p));
  const resumed = interrupts.filter((i) =>
    s.actionLogs.some(
      (l) => l.taskId === i.taskId && (l.type === "resume" || l.type === "start") && new Date(l.at) > new Date(i.at),
    ),
  );
  return rate(resumed.length, interrupts.length);
}

function isScheduled(h: Habit, d: Date): boolean {
  return h.weekdays.length === 0 || h.weekdays.includes(d.getDay());
}

/** 習慣実行率 = 実行回数 ÷ 実行予定回数（習慣作成日以降、今日まで） */
export function habitRate(s: AppState, p: Period, now = new Date()): number | null {
  let planned = 0;
  let done = 0;
  const end = new Date(Math.min(p.to.getTime(), now.getTime() + 1));
  for (const h of s.habits.filter((x) => !x.archived)) {
    const created = new Date(h.createdAt);
    const cursor = new Date(Math.max(p.from.getTime(), new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime()));
    cursor.setHours(0, 0, 0, 0);
    while (cursor < end) {
      if (isScheduled(h, cursor)) {
        planned++;
        const key = localDate(cursor);
        if (s.habitLogs.some((l) => l.habitId === h.id && l.date === key)) done++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return rate(done, planned);
}

/** 介入後着手率 = タスクに紐づく介入のうち、10分以内に着手したもの */
export function interventionStartRate(s: AppState, p: Period, windowMin = 10): number | null {
  const targets = s.interventions.filter((i) => i.taskId && inPeriod(i.at, p));
  const started = targets.filter((i) =>
    s.actionLogs.some((l) => {
      if (l.taskId !== i.taskId || (l.type !== "start" && l.type !== "resume" && l.type !== "minimum")) return false;
      const dt = new Date(l.at).getTime() - new Date(i.at).getTime();
      return dt >= 0 && dt <= windowMin * 60000;
    }),
  );
  return rate(started.length, targets.length);
}

/** 集中時間（ミリ秒）。進行中のセッションは now まで */
export function focusMs(s: AppState, p: Period, now = new Date()): number {
  return s.focusSessions
    .filter((f) => inPeriod(f.startedAt, p))
    .reduce((sum, f) => {
      const end = f.endedAt ? new Date(f.endedAt) : f.pausedAt ? new Date(f.pausedAt) : now;
      return sum + Math.max(0, end.getTime() - new Date(f.startedAt).getTime() - f.pausedMs);
    }, 0);
}

export function habitStreakInfo(s: AppState, habitId: string, now = new Date()) {
  const logs = s.habitLogs.filter((l) => l.habitId === habitId);
  const dates = new Set(logs.map((l) => l.date));
  let streak = 0;
  const d = new Date(now);
  if (!dates.has(localDate(d))) d.setDate(d.getDate() - 1); // 今日未実行でも昨日までの連続は表示
  while (dates.has(localDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  // 復帰回数：2日以上空いた後に再開した回数
  const sorted = [...dates].sort();
  let comebacks = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000;
    if (gap >= 2) comebacks++;
  }
  return { streak, total: logs.length, comebacks, doneToday: dates.has(localDate(now)) };
}

export function blockerDistribution(s: AppState, p: Period): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of s.interventions.filter((x) => inPeriod(x.at, p))) out[i.blocker] = (out[i.blocker] ?? 0) + 1;
  return out;
}
