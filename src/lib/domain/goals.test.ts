import { describe, expect, it } from "vitest";
import { addTask, completeTask, emptyState, interruptTask, startTask } from "./actions";
import {
  addGoal,
  addMetric,
  addMilestone,
  addRisk,
  addStrategy,
  addValue,
  applyPlanDraft,
  changePlan,
  deleteGoal,
  deleteValue,
  diagnose,
  forecastGoal,
  generateBackwardPlan,
  goalHealth,
  goalProgress,
  logMetric,
  plannedProgress,
  resourceSummary,
  restorePlanVersion,
  saveWoop,
  selectStrategy,
  setGoalStatus,
  smartCheck,
  strategyScore,
  strategyTemplates,
  syncAllProgress,
  toggleMilestone,
  updateGoal,
  wouldCreateCycle,
  GOAL_ACHIEVED_XP,
  MILESTONE_XP_DAILY_CAP,
} from "./goals";
import { dueReviews, saveReview } from "./reviews";
import type { AppState } from "./types";
import { totalXp } from "./xp";
import { loadState } from "../store";

const NOW = new Date(2026, 10, 24, 12, 0, 0);
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const last = <T,>(xs: T[]) => xs[xs.length - 1];

function goal(s: AppState = emptyState(), input: Parameters<typeof addGoal>[1] = { title: "公認会計士試験に合格" }) {
  const st = addGoal(s, input, NOW);
  return { s: st, id: last(st.goals).id };
}

describe("目標 CRUD と階層", () => {
  it("登録・編集・削除。削除しても紐づくタスクは残る", () => {
    const g0 = goal();
    let s = g0.s;
    const id = g0.id;
    s = updateGoal(s, id, { description: "短答式から" }, NOW);
    expect(s.goals[0].description).toBe("短答式から");
    s = addTask(s, { title: "テキストを開く", goalId: id }, NOW);
    s = deleteGoal(s, id);
    expect(s.goals).toHaveLength(0);
    expect(s.tasks).toHaveLength(1);
    expect(s.tasks[0].goalId).toBeNull();
  });

  it("親子関係を設定でき、循環は拒否する。親を消すと子は祖父母に付け替わる", () => {
    const a = goal(emptyState(), { title: "経済的自立" });
    const b = goal(a.s, { title: "資格取得", parentId: a.id });
    const c = goal(b.s, { title: "簿記2級", parentId: b.id });
    expect(wouldCreateCycle(c.s.goals, a.id, c.id)).toBe(true);
    expect(() => updateGoal(c.s, a.id, { parentId: c.id })).toThrow();
    const s = deleteGoal(c.s, b.id);
    expect(s.goals.find((g) => g.id === c.id)?.parentId).toBe(a.id);
  });

  it("価値観と紐付けでき、価値観を消すと紐付けも外れる", () => {
    let s = addValue(emptyState(), "自律性");
    const vid = s.values[0].id;
    const g = goal(s, { title: "独立", valueIds: [vid] });
    s = deleteValue(g.s, vid);
    expect(s.goals[0].valueIds).toEqual([]);
  });
});

describe("進捗とマイルストーン", () => {
  it("マイルストーンの重要度で重み付けした進捗", () => {
    const g0 = goal();
    let s = g0.s;
    const id = g0.id;
    s = addMilestone(s, id, { title: "基礎", weight: 1 }, NOW);
    s = addMilestone(s, id, { title: "過去問", weight: 3 }, NOW);
    s = toggleMilestone(s, s.milestones[1].id, NOW);
    expect(goalProgress(s, id)).toEqual({ value: 0.75, basis: "milestones" });
  });

  it("マイルストーンXPは1回だけ、取り消すと戻る、1日の上限あり", () => {
    const g0 = goal();
    let s = g0.s;
    const id = g0.id;
    for (let i = 0; i < MILESTONE_XP_DAILY_CAP + 2; i++) s = addMilestone(s, id, { title: `M${i}`, xp: 100 }, NOW);
    const m0 = s.milestones[0].id;
    s = toggleMilestone(s, m0, NOW);
    expect(totalXp(s.xpLogs)).toBe(100);
    s = toggleMilestone(s, m0, NOW);
    expect(totalXp(s.xpLogs)).toBe(0);
    for (const m of s.milestones) s = toggleMilestone(s, m.id, NOW);
    expect(totalXp(s.xpLogs)).toBe(MILESTONE_XP_DAILY_CAP * 100);
  });

  it("XPの上限を超える値は丸める", () => {
    const g0 = goal();
    let s = g0.s;
    const id = g0.id;
    s = addMilestone(s, id, { title: "ボス戦", xp: 100000 }, NOW);
    s = toggleMilestone(s, s.milestones[0].id, NOW);
    expect(totalXp(s.xpLogs)).toBe(150);
  });

  it("目標達成XPは1回だけ", () => {
    const g0 = goal();
    let s = g0.s;
    const id = g0.id;
    s = setGoalStatus(s, id, "achieved", NOW);
    s = setGoalStatus(s, id, "active", NOW);
    s = setGoalStatus(s, id, "achieved", NOW);
    expect(totalXp(s.xpLogs)).toBe(GOAL_ACHIEVED_XP);
  });

  it("結果指標で進捗を測れる。子目標の進捗は親に集約される", () => {
    const parent = goal(emptyState(), { title: "英語力" });
    const g0 = goal(parent.s, { title: "TOEIC800", parentId: parent.id });
    let s = g0.s;
    const id = g0.id;
    s = addMetric(s, id, { name: "TOEIC", kind: "lag", unit: "点", start: 500, target: 800, frequency: "monthly", method: "公開テスト" }, NOW);
    s = logMetric(s, s.metrics[0].id, 650, NOW);
    expect(goalProgress(s, id).value).toBeCloseTo(0.5);
    expect(goalProgress(s, parent.id)).toEqual({ value: 0.5, basis: "children" });
  });

  it("紐づくタスクの完了で進捗を測れる（最低目標は0.5）", () => {
    const g0 = goal();
    let s = g0.s;
    const id = g0.id;
    s = addTask(s, { title: "A", goalId: id }, NOW);
    s = addTask(s, { title: "B", goalId: id }, NOW);
    s = completeTask(s, s.tasks[0].id, NOW);
    expect(goalProgress(s, id)).toEqual({ value: 0.5, basis: "tasks" });
  });
});

describe("計画と実績・予測", () => {
  it("計画上の進捗（線形）と遅れの判定", () => {
    const g0 = goal(emptyState(), { title: "X", startDate: "2026-11-01", dueDate: "2026-12-31" });
    let s = g0.s;
    const id = g0.id;
    s = updateGoal(s, id, { manualProgress: 0 }, NOW);
    expect(plannedProgress(s, id, NOW)).toBeCloseTo(23 / 60, 2);
    expect(goalHealth(s, id, NOW)).toBe("behind");
  });

  it("データが少ないときは予測しない", () => {
    const { s, id } = goal(emptyState(), { title: "X", dueDate: "2027-06-01" });
    const f = forecastGoal(s, id, NOW);
    expect(f.confidence).toBe("insufficient");
    expect(f.projectedDate).toBeNull();
  });

  it("進捗の推移からペースと想定完了日を推定する", () => {
    const g0 = goal(emptyState(), { title: "X", startDate: "2026-11-01", dueDate: "2027-03-01" });
    let s = g0.s;
    const id = g0.id;
    s = addMetric(s, id, { name: "問題数", kind: "lag", unit: "問", start: 0, target: 100, frequency: "weekly", method: "" }, day(-14));
    s = logMetric(s, s.metrics[0].id, 10, day(-7));
    s = logMetric(s, s.metrics[0].id, 20, NOW);
    const f = forecastGoal(s, id, NOW);
    expect(f.confidence).toBe("low");
    expect(f.pacePerWeek).toBeCloseTo(0.1, 2); // 14日で20%
    expect(f.projectedDate).toBe("2027-01-19"); // 残り80% ÷ 1/70日 = 56日後
    expect(f.scenarios.length).toBeGreaterThanOrEqual(4);
  });
});

describe("タスク完了と進捗履歴の同期", () => {
  it("タスク完了による進捗の変化を履歴に記録する（変化がなければ記録しない）", () => {
    const g0 = goal();
    let s = addTask(g0.s, { title: "A", goalId: g0.id }, NOW);
    s = addTask(s, { title: "B", goalId: g0.id }, NOW);
    s = syncAllProgress(s, NOW);
    const before = s.progressLogs.length;
    expect(syncAllProgress(s, NOW).progressLogs.length).toBe(before);
    s = syncAllProgress(completeTask(s, s.tasks[0].id, day(1)), day(1));
    expect(last(s.progressLogs)).toMatchObject({ goalId: g0.id, progress: 0.5 });
  });
});

describe("計画変更の履歴", () => {
  it("重要な変更は変更前を履歴に残し、復元できる", () => {
    const g0 = goal(emptyState(), { title: "X", dueDate: "2027-01-01" });
    let s = g0.s;
    const id = g0.id;
    s = addMilestone(s, id, { title: "M1" }, NOW);
    s = changePlan(s, id, { dueDate: "2027-03-01" }, "期限を延長", NOW);
    expect(s.goals[0].dueDate).toBe("2027-03-01");
    expect(s.planVersions).toHaveLength(1);
    expect(s.planVersions[0].snapshot.goal.dueDate).toBe("2027-01-01");
    s = restorePlanVersion(s, s.planVersions[0].id, NOW);
    expect(s.goals[0].dueDate).toBe("2027-01-01");
    expect(s.planVersions).toHaveLength(2); // 復元前の状態も残る
  });
});

describe("逆算計画", () => {
  const input = {
    startDate: "2026-12-01",
    dueDate: "2027-05-31",
    phases: ["基礎", "演習", "過去問"],
    weeklyHours: 10,
    totalHours: null,
    restDaysPerWeek: 1,
    bufferRatio: 0.1,
    nearTermWeeks: 2,
  };

  it("期限から逆算してマイルストーンを作り、予備期間を残す", () => {
    const d = generateBackwardPlan(input);
    expect(d.milestones).toHaveLength(3);
    expect(d.milestones[0].startDate).toBe("2026-12-01");
    expect(last(d.milestones).dueDate < "2027-05-31").toBe(true);
    for (let i = 1; i < d.milestones.length; i++) expect(d.milestones[i].startDate > d.milestones[i - 1].dueDate).toBe(true);
  });

  it("詳細タスクは直近の週だけ（ローリングウェーブ）", () => {
    const d = generateBackwardPlan(input);
    expect(d.tasks.length).toBe(12); // 2週間 × 週6日
    expect(d.tasks.every((t) => t.plannedStart < "2026-12-15")).toBe(true);
  });

  it("作業量が利用可能時間を超えると警告する（期限は勝手に変えない）", () => {
    const d = generateBackwardPlan({ ...input, totalHours: 1000 });
    expect(d.warnings.some((w) => w.includes("1000時間"))).toBe(true);
    expect(last(d.milestones).dueDate <= input.dueDate).toBe(true);
  });

  it("承認すると既存のタスク管理に反映され、履歴が残る", () => {
    const g0 = goal(emptyState(), { title: "X", status: "planning" });
    let s = g0.s;
    const id = g0.id;
    s = addMilestone(s, id, { title: "既存" }, NOW);
    const d = generateBackwardPlan(input);
    s = applyPlanDraft(s, id, d, { setDueDate: input.dueDate }, NOW);
    expect(s.milestones).toHaveLength(4); // 既存は消さない
    expect(s.tasks).toHaveLength(12);
    expect(s.tasks.every((t) => t.goalId === id && t.milestoneId)).toBe(true);
    expect(s.planVersions).toHaveLength(1);
    expect(s.goals[0].status).toBe("active");
    expect(s.goals[0].dueDate).toBe(input.dueDate);
  });

  it("不正な入力では計画を作らない", () => {
    expect(generateBackwardPlan({ ...input, dueDate: "2026-12-02" }).milestones).toHaveLength(0);
    expect(generateBackwardPlan({ ...input, phases: [] }).warnings.length).toBe(1);
  });
});

describe("戦略比較", () => {
  it("5つのシナリオを作り、重み付きで比較。採用はユーザー操作で履歴に残る", () => {
    const g0 = goal();
    let s = g0.s;
    const id = g0.id;
    for (const t of strategyTemplates({ months: 12, hoursPerWeek: 10, cost: 100000 })) s = addStrategy(s, id, t);
    expect(s.strategies).toHaveLength(5);
    const weights = { speed: 5, timeLoad: 0, cost: 0, difficulty: 0, risk: 0, valueFit: 0, sideEffects: 0 };
    const best = [...s.strategies].sort((a, b) => strategyScore(b, weights) - strategyScore(a, weights))[0];
    expect(best.kind).toBe("fastest");
    expect(s.strategies.some((x) => x.selected)).toBe(false);
    s = selectStrategy(s, best.id, NOW);
    expect(s.strategies.filter((x) => x.selected).map((x) => x.id)).toEqual([best.id]);
    expect(s.planVersions).toHaveLength(1);
  });
});

describe("心理支援・if-then との連携", () => {
  it("WOOP の Plan を if-then ルールとして登録する", () => {
    const g0 = goal();
    let s = g0.s;
    const id = g0.id;
    s = saveWoop(s, id, { wish: "合格", outcome: "選択肢が広がる", obstacle: "疲れて机に向かえない", ifText: "疲れて机に向かえないとき", thenText: "問題を1問だけ解く" }, true, NOW);
    expect(s.rules).toHaveLength(1);
    expect(s.goals[0].woop?.ruleId).toBe(s.rules[0].id);
    // 再保存してもルールは重複しない
    s = saveWoop(s, id, { wish: "合格", outcome: "", obstacle: "", ifText: "a", thenText: "b" }, true, NOW);
    expect(s.rules).toHaveLength(1);
  });

  it("リスクの対処を if-then ルールとして登録できる", () => {
    const g0 = goal();
    let s = g0.s;
    const id = g0.id;
    s = addRisk(s, id, { title: "体調不良", trigger: "睡眠6時間未満が続く", likelihood: 3, impact: 4, prevention: "23時就寝", response: "プランBへ" }, { ifText: "睡眠不足の日は", thenText: "最低目標だけにする" }, NOW);
    expect(s.risks[0].ruleId).toBe(s.rules[0].id);
  });
});

describe("リソースと診断", () => {
  it("配分時間が利用可能時間を超えると過密として検出する", () => {
    let s = emptyState();
    s = { ...s, settings: { ...s.settings, planning: { weeklyAvailableHours: 20, reserveRatio: 0.2, birthYear: null } } };
    for (const t of ["資格A", "資格B", "資格C"]) s = addGoal(s, { title: t, status: "active", focus: "main", weeklyHours: 8 }, NOW);
    const r = resourceSummary(s, NOW);
    expect(r.available).toBe(16);
    expect(r.allocated).toBe(24);
    expect(r.overloaded).toBe(true);
    expect(diagnose(s, NOW).some((d) => d.kind === "resource" && d.goalId === null)).toBe(true);
  });

  it("目標に紐づくタスクの集中時間を実績として集計する", () => {
    const g0 = goal(emptyState(), { title: "X", status: "active", weeklyHours: 5 });
    let s = g0.s;
    const id = g0.id;
    s = addTask(s, { title: "演習", goalId: id }, NOW);
    s = startTask(s, s.tasks[0].id, NOW);
    s = interruptTask(s, s.tasks[0].id, "休憩", new Date(NOW.getTime() + 90 * 60000));
    expect(resourceSummary(s, new Date(NOW.getTime() + 2 * 3_600_000)).byGoal[0].actualThisWeek).toBeCloseTo(1.5);
  });

  it("子目標の期限が親より後なら矛盾として指摘する", () => {
    const p = goal(emptyState(), { title: "親", dueDate: "2027-01-01" });
    const c = goal(p.s, { title: "子", parentId: p.id, dueDate: "2027-06-01" });
    expect(diagnose(c.s, NOW).some((d) => d.goalId === c.id && d.kind === "structure")).toBe(true);
  });

  it("遅れの原因として着手の問題（心理的阻害）を区別する", () => {
    const g0 = goal(emptyState(), { title: "X", status: "active", startDate: "2026-10-01", dueDate: "2026-12-31", weeklyHours: 5 });
    let s = g0.s;
    const id = g0.id;
    s = updateGoal(s, id, { manualProgress: 0 }, NOW);
    for (let i = 1; i <= 4; i++) s = addTask(s, { title: `T${i}`, goalId: id, plannedStart: day(-i).toISOString() }, NOW);
    const d = diagnose(s, NOW).find((x) => x.goalId === id && x.kind === "psych");
    expect(d).toBeTruthy();
  });

  it("SMART チェック", () => {
    const { s, id } = goal(emptyState(), { title: "X", dueDate: "2027-01-01", successCriteria: "本試験に合格する", why: "専門性" });
    const c = smartCheck(s, s.goals.find((g) => g.id === id)!);
    expect(c.filter((x) => x.ok).map((x) => x.key)).toEqual(["S", "R", "T"]);
  });
});

describe("定期レビュー", () => {
  it("回答と実施時点の集計を保存する。空のレビューは保存しない", () => {
    let { s } = goal();
    expect(() => saveReview(s, "weekly", { gap: " " }, NOW)).toThrow();
    s = saveReview(s, "weekly", { gap: "演習が遅れた" }, NOW);
    expect(s.reviews[0].stats["完了率"]).toBe("データなし");
    expect(dueReviews(s, NOW)).not.toContain("weekly");
    expect(dueReviews(s, day(8))).toContain("weekly");
  });
});

describe("既存データのマイグレーション", () => {
  it("目標機能追加前のデータを読み込んでも既存データが維持される", () => {
    const old = {
      version: 1,
      tasks: [{ id: "t1", title: "旧タスク", status: "done" }],
      habits: [{ id: "h1", name: "読書" }],
      xpLogs: [{ key: "done:t1", amount: 20, reason: "", at: NOW.toISOString() }],
      settings: { gamification: false, aiEnabled: false, weights: {} },
    };
    const s = loadState(JSON.stringify(old));
    expect(s.tasks[0].title).toBe("旧タスク");
    expect(s.tasks[0].goalId).toBeNull();
    expect(s.habits).toHaveLength(1);
    expect(totalXp(s.xpLogs)).toBe(20);
    expect(s.goals).toEqual([]);
    expect(s.settings.gamification).toBe(false);
    expect(s.settings.planning.weeklyAvailableHours).toBe(14);
  });
});
