import { forecastGoal, goalProgress, OPEN_STATUSES, resourceSummary } from "./goals";
import { completionRate, formatRate, habitRate, startRate, type Period } from "./kpi";
import type { AppState, Review, ReviewKind } from "./types";
import { uid } from "./util";

export const REVIEW_LABEL: Record<ReviewKind, string> = {
  daily: "日次",
  weekly: "週間",
  monthly: "月間",
  quarterly: "四半期",
  annual: "年間",
};

/** 要件 18 の各レビュー項目 */
export const REVIEW_QUESTIONS: Record<ReviewKind, { key: string; label: string }[]> = {
  daily: [
    { key: "did", label: "今日の行動" },
    { key: "result", label: "今日の成果" },
    { key: "contribution", label: "長期目標への貢献" },
    { key: "tomorrow", label: "明日の最重要タスク" },
  ],
  weekly: [
    { key: "gap", label: "計画と実績の差" },
    { key: "blockers", label: "行動できなかった原因" },
    { key: "bottleneck", label: "現在のボトルネック" },
    { key: "focus", label: "翌週の重点タスク" },
    { key: "change", label: "計画の修正" },
  ],
  monthly: [
    { key: "progress", label: "長期目標の進捗" },
    { key: "milestones", label: "マイルストーン達成状況" },
    { key: "strategy", label: "戦略の有効性" },
    { key: "time", label: "時間配分" },
    { key: "money", label: "資金配分" },
    { key: "priority", label: "目標の優先順位" },
    { key: "next", label: "翌月の計画" },
  ],
  quarterly: [
    { key: "continue", label: "現在の戦略を継続するか" },
    { key: "change", label: "戦略を変更するか" },
    { key: "modify", label: "目標を修正するか" },
    { key: "focus", label: "他の目標に集中するか" },
    { key: "new", label: "新しい目標を追加するか" },
  ],
  annual: [
    { key: "achieved", label: "年間目標の達成状況" },
    { key: "values", label: "価値観の変化" },
    { key: "career", label: "キャリアの進捗" },
    { key: "skills", label: "習得した能力" },
    { key: "success", label: "重要な成功体験" },
    { key: "lessons", label: "失敗から得た知識" },
    { key: "strategy", label: "翌年の戦略" },
    { key: "roadmap", label: "人生ロードマップの更新" },
  ],
};

export function reviewPeriod(kind: ReviewKind, now = new Date()): Period {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const days = { daily: 1, weekly: 7, monthly: 30, quarterly: 91, annual: 365 }[kind];
  return { from: new Date(end.getTime() - days * 86_400_000), to: end };
}

/** レビュー時点の自動集計（実績データから算出） */
export function reviewStats(s: AppState, kind: ReviewKind, now = new Date()): Record<string, string> {
  const p = reviewPeriod(kind, now);
  const stats: Record<string, string> = {
    着手率: formatRate(startRate(s, p)),
    完了率: formatRate(completionRate(s, p)),
    習慣実行率: formatRate(habitRate(s, p, now)),
  };
  const done = s.milestones.filter((m) => m.doneAt && new Date(m.doneAt) >= p.from && new Date(m.doneAt) < p.to).length;
  stats["期間内のマイルストーン達成"] = `${done}件`;
  const res = resourceSummary(s, now);
  stats["週の配分時間"] = `${res.allocated.toFixed(1)} / ${res.available.toFixed(1)}時間${res.overloaded ? "（過密）" : ""}`;
  for (const g of s.goals.filter((x) => OPEN_STATUSES.includes(x.status)).slice(0, 8)) {
    const f = forecastGoal(s, g.id, now);
    const pr = goalProgress(s, g.id).value;
    stats[`目標：${g.title}`] = `進捗${Math.round(pr * 100)}%${f.planned !== null ? `（計画${Math.round(f.planned * 100)}%）` : ""}`;
  }
  return stats;
}

export function saveReview(s: AppState, kind: ReviewKind, answers: Record<string, string>, now = new Date()): AppState {
  if (!Object.values(answers).some((v) => v.trim())) throw new Error("少なくとも1項目を記入してください");
  const r: Review = { id: uid(), kind, at: now.toISOString(), answers, stats: reviewStats(s, kind, now) };
  return { ...s, reviews: [...s.reviews, r] };
}

export function deleteReview(s: AppState, id: string): AppState {
  return { ...s, reviews: s.reviews.filter((r) => r.id !== id) };
}

/** 次のレビュー時期の目安（最後の実施日からの経過日数で判定） */
export function dueReviews(s: AppState, now = new Date()): ReviewKind[] {
  const limits: Record<ReviewKind, number> = { daily: 1, weekly: 7, monthly: 30, quarterly: 91, annual: 365 };
  return (Object.keys(limits) as ReviewKind[]).filter((k) => {
    const last = [...s.reviews].reverse().find((r) => r.kind === k);
    if (!last) return k === "weekly"; // 初回は週間レビューのみ促す
    return (now.getTime() - new Date(last.at).getTime()) / 86_400_000 >= limits[k];
  });
}
