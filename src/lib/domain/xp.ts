import type { XpLog } from "./types";
import { localDate } from "./util";

// 要件 12.1 の初期設定値
export const XP_TABLE = {
  taskStart: 5,
  minimumDone: 10,
  taskDone: 20,
  mostImportantDone: 30,
  recovery: 15,
  psychWork: 5,
  habitDone: 10,
  weeklyGoal: 100,
  bigGoal: 500,
} as const;

/** 心理ワークで得られるXPの1日上限（無制限稼ぎの防止） */
export const PSYCH_WORK_DAILY_CAP = 5;

/**
 * 冪等なXP付与。同じ key が既にあれば何もしない。
 * 戻り値は新しいログ配列と、実際に付与されたかどうか。
 */
export function awardXp(
  logs: XpLog[],
  key: string,
  amount: number,
  reason: string,
  now: Date = new Date(),
): { logs: XpLog[]; awarded: boolean } {
  if (logs.some((l) => l.key === key)) return { logs, awarded: false };
  return { logs: [...logs, { key, amount, reason, at: now.toISOString() }], awarded: true };
}

/** 心理ワークXPの付与（1日上限つき） */
export function awardPsychWorkXp(logs: XpLog[], interventionId: string, now: Date = new Date()) {
  const today = localDate(now);
  const todayCount = logs.filter((l) => l.key.startsWith("psych:") && localDate(l.at) === today).length;
  if (todayCount >= PSYCH_WORK_DAILY_CAP) return { logs, awarded: false };
  return awardXp(logs, `psych:${interventionId}`, XP_TABLE.psychWork, "心理ワーク実施", now);
}

export function totalXp(logs: XpLog[]): number {
  return logs.reduce((s, l) => s + l.amount, 0);
}

/** レベル L から L+1 に必要なXP */
export function xpForNextLevel(level: number): number {
  return 50 + 25 * (level - 1);
}

/** 累積XPからレベル情報を計算。XPは減らない（連続記録が途切れても失わない） */
export function levelInfo(xp: number): { level: number; current: number; needed: number } {
  let level = 1;
  let rest = Math.max(0, xp);
  while (rest >= xpForNextLevel(level)) {
    rest -= xpForNextLevel(level);
    level++;
  }
  return { level, current: rest, needed: xpForNextLevel(level) };
}

export function levelTitle(level: number): string {
  if (level >= 30) return "自律の探究者";
  if (level >= 20) return "習慣の設計者";
  if (level >= 10) return "継続する人";
  if (level >= 5) return "着手する人";
  return "最初の一歩";
}
