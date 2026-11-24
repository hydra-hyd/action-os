import { describe, expect, it } from "vitest";
import {
  activeFocus,
  addHabit,
  addRule,
  addTask,
  completeMinimum,
  completeTask,
  deleteTask,
  emptyState,
  interruptTask,
  logHabit,
  logIntervention,
  logRule,
  pauseFocus,
  resumeFocus,
  ruleExecutionRate,
  ruleSuggestions,
  startTask,
  undoHabitToday,
  updateTask,
  type TaskInput,
} from "./actions";
import { ruleBasedDecompose } from "./decompose";
import {
  completionRate,
  focusMs,
  habitRate,
  habitStreakInfo,
  interventionStartRate,
  medianStartDelayMin,
  rate,
  recoveryRate,
  startRate,
} from "./kpi";
import { DEFAULT_WEIGHTS, pickFrog, priorityScore, rankTasks } from "./priority";
import { INTERVENTION_RULES, TECHNIQUES, defuse, recommendTechniques } from "./techniques";
import type { AppState } from "./types";
import { PSYCH_WORK_DAILY_CAP, levelInfo, totalXp } from "./xp";
import { loadState } from "../store";

const T0 = new Date(2026, 10, 24, 9, 0, 0);
const at = (min: number) => new Date(T0.getTime() + min * 60000);
const day = { from: new Date(2026, 10, 24), to: new Date(2026, 10, 25) };

function withTask(title = "勉強する", extra: Partial<TaskInput> = {}): [AppState, string] {
  const s = addTask(emptyState(), { title, plannedStart: T0.toISOString(), ...extra }, T0);
  return [s, s.tasks[0].id];
}

describe("タスク CRUD", () => {
  it("登録・編集・削除ができる", () => {
    const init = withTask();
    let s = init[0];
    const id = init[1];
    expect(s.tasks).toHaveLength(1);
    s = updateTask(s, id, { title: "簿記の勉強" });
    expect(s.tasks[0].title).toBe("簿記の勉強");
    s = deleteTask(s, id);
    expect(s.tasks).toHaveLength(0);
  });

  it("空のタスク名は拒否する", () => {
    expect(() => addTask(emptyState(), { title: "   " })).toThrow();
  });

  it("最重要タスクは1つだけ", () => {
    let s = addTask(emptyState(), { title: "A", isMostImportant: true });
    s = addTask(s, { title: "B", isMostImportant: true });
    expect(s.tasks.filter((t) => t.isMostImportant).map((t) => t.title)).toEqual(["B"]);
  });
});

describe("1タップ着手・中断・復帰", () => {
  it("開始で実行中になり、集中セッションと着手時刻・遅延が記録される", () => {
    const init = withTask();
    let s = init[0];
    const id = init[1];
    s = startTask(s, id, at(12));
    expect(s.tasks[0].status).toBe("doing");
    expect(s.tasks[0].firstStartedAt).toBe(at(12).toISOString());
    expect(activeFocus(s)?.taskId).toBe(id);
    expect(medianStartDelayMin(s, day)).toBe(12);
  });

  it("中断→再開で復帰XPが1回だけ付与され、次の行動が保存される", () => {
    const init = withTask();
    let s = init[0];
    const id = init[1];
    s = startTask(s, id, at(0));
    s = interruptTask(s, id, "通知", at(10), { nextAction: "問題3から" });
    expect(s.tasks[0].status).toBe("interrupted");
    expect(s.tasks[0].nextAction).toBe("問題3から");
    expect(activeFocus(s)).toBeUndefined();
    s = startTask(s, id, at(20));
    const xpAfterFirst = totalXp(s.xpLogs);
    expect(s.xpLogs.some((x) => x.key.startsWith("recovery:"))).toBe(true);
    expect(recoveryRate(s, day)).toBe(100);
    // 同じ日に再度開始しても着手XPは重複しない
    s = startTask(s, id, at(21));
    expect(totalXp(s.xpLogs)).toBe(xpAfterFirst);
  });

  it("別タスクを開始すると実行中のタスクは一時停止される（シングルタスク）", () => {
    let s = addTask(emptyState(), { title: "A" }, T0);
    s = addTask(s, { title: "B" }, T0);
    const [a, b] = s.tasks.map((t) => t.id);
    s = startTask(s, a, at(0));
    s = startTask(s, b, at(5));
    expect(s.tasks.find((t) => t.id === a)?.status).toBe("paused");
    expect(s.focusSessions.filter((f) => !f.endedAt)).toHaveLength(1);
  });

  it("一時停止中の時間は集中時間に含めない", () => {
    const init = withTask();
    let s = init[0];
    const id = init[1];
    s = startTask(s, id, at(0));
    s = pauseFocus(s, at(10));
    s = resumeFocus(s, at(15));
    s = completeTask(s, id, at(25));
    expect(focusMs(s, day, at(30))).toBe(20 * 60000);
  });
});

describe("3段階目標とXP", () => {
  it("最低目標達成は完了と区別され、両方のXPが1回ずつ", () => {
    const init = withTask();
    let s = init[0];
    const id = init[1];
    s = startTask(s, id, at(0));
    s = completeMinimum(s, id, at(5));
    expect(s.tasks[0].status).toBe("minimum_done");
    expect(completionRate(s, day)).toBe(0);
    s = completeMinimum(s, id, at(6));
    expect(s.xpLogs.filter((x) => x.key.startsWith("min:"))).toHaveLength(1);
    s = completeTask(s, id, at(10));
    s = completeTask(s, id, at(11));
    expect(s.xpLogs.filter((x) => x.key.startsWith("done:"))).toHaveLength(1);
    expect(totalXp(s.xpLogs)).toBe(5 + 10 + 20);
  });

  it("最重要タスクの完了は30XP", () => {
    const init = withTask("A", { isMostImportant: true });
    let s = init[0];
    const id = init[1];
    s = completeTask(s, id, at(1));
    expect(totalXp(s.xpLogs)).toBe(30);
  });

  it("心理ワークXPには1日の上限がある", () => {
    let s = emptyState();
    for (let i = 0; i < PSYCH_WORK_DAILY_CAP + 3; i++) {
      s = logIntervention(s, { taskId: null, blocker: "bother", techniqueId: "thirty_sec", outcome: "none" }, at(i));
    }
    expect(totalXp(s.xpLogs)).toBe(PSYCH_WORK_DAILY_CAP * 5);
  });

  it("レベル計算", () => {
    expect(levelInfo(0)).toEqual({ level: 1, current: 0, needed: 50 });
    expect(levelInfo(50).level).toBe(2);
    expect(levelInfo(49).level).toBe(1);
  });
});

describe("KPI：分母0はデータなし", () => {
  it("rate は分母0で null", () => {
    expect(rate(0, 0)).toBeNull();
    expect(startRate(emptyState(), day)).toBeNull();
    expect(habitRate(emptyState(), day, at(0))).toBeNull();
    expect(interventionStartRate(emptyState(), day)).toBeNull();
  });

  it("介入後10分以内の着手を数える", () => {
    const init = withTask();
    let s = init[0];
    const id = init[1];
    s = logIntervention(s, { taskId: id, blocker: "bother", techniqueId: "thirty_sec", outcome: "started" }, at(0));
    s = startTask(s, id, at(3));
    expect(interventionStartRate(s, day)).toBe(100);
  });
});

describe("習慣", () => {
  it("1日1回まで記録・XPも1回、取消でXPも戻る、途切れても累積は残る", () => {
    let s = addHabit(emptyState(), { name: "英単語", minimum: "1個", anchor: "歯磨き", weekdays: [] }, T0);
    const id = s.habits[0].id;
    s = logHabit(s, id, "minimum", at(0));
    s = logHabit(s, id, "minimum", at(1));
    s = logHabit(s, id, "normal", at(2)); // 格上げ
    expect(s.habitLogs).toHaveLength(1);
    expect(s.habitLogs[0].level).toBe("normal");
    expect(totalXp(s.xpLogs)).toBe(10);
    s = undoHabitToday(s, id, at(3));
    expect(s.habitLogs).toHaveLength(0);
    expect(totalXp(s.xpLogs)).toBe(0);

    s = logHabit(s, id, "minimum", new Date(2026, 10, 24, 8));
    s = logHabit(s, id, "minimum", new Date(2026, 10, 27, 8)); // 2日空けて復帰
    const info = habitStreakInfo(s, id, new Date(2026, 10, 27, 20));
    expect(info.total).toBe(2);
    expect(info.comebacks).toBe(1);
    expect(info.streak).toBe(1);
  });

  it("習慣実行率", () => {
    let s = addHabit(emptyState(), { name: "読書", minimum: "1ページ", anchor: "", weekdays: [] }, new Date(2026, 10, 23, 7));
    const id = s.habits[0].id;
    s = logHabit(s, id, "minimum", new Date(2026, 10, 24, 8));
    const p = { from: new Date(2026, 10, 23), to: new Date(2026, 10, 25) };
    expect(habitRate(s, p, new Date(2026, 10, 24, 20))).toBe(50);
  });
});

describe("if-then", () => {
  it("登録・実行率・改善提案", () => {
    let s = addRule(emptyState(), { ifText: "帰宅したら", thenText: "テキストを開く", trigger: "habit" });
    const id = s.rules[0].id;
    expect(ruleExecutionRate(s, id).rate).toBeNull();
    s = logRule(s, id, false);
    s = logRule(s, id, false);
    s = logRule(s, id, true);
    const r = ruleExecutionRate(s, id);
    expect(Math.round(r.rate!)).toBe(33);
    expect(ruleSuggestions(r.rate, r.count).length).toBeGreaterThan(0);
    expect(() => addRule(emptyState(), { ifText: "", thenText: "x", trigger: "other" })).toThrow();
  });
});

describe("心理テクニック", () => {
  it("すべての阻害要因に推奨テクニックがあり、IDが実在する", () => {
    for (const [blocker, ids] of Object.entries(INTERVENTION_RULES)) {
      expect(recommendTechniques(blocker as keyof typeof INTERVENTION_RULES)).toHaveLength(ids.length);
    }
  });

  it("すべてのテクニックに出典情報と取得状況がある", () => {
    for (const t of TECHNIQUES) {
      expect(t.source.title).toBeTruthy();
      expect(["notion_unsynced", "requirements_only"]).toContain(t.sourceStatus);
    }
  });

  it("脱フュージョンの言い換え", () => {
    expect(defuse("自分にはできない。")).toBe("私は今、「自分にはできない」という考えを持っている。");
    expect(defuse("  ")).toBe("");
  });
});

describe("優先順位", () => {
  it("要件20の式どおりに計算する", () => {
    const [s] = withTask("A", { importance: 100, urgency: 0, valueAlignment: 0, longTermImpact: 0, feasibility: 0 });
    expect(priorityScore(s.tasks[0], DEFAULT_WEIGHTS, T0)).toBeCloseTo(30);
  });

  it("心理的負担が大きくても優先度は下がらない", () => {
    const [a] = withTask("A", { psychLoad: 0 });
    const [b] = withTask("B", { psychLoad: 100 });
    expect(priorityScore(a.tasks[0], DEFAULT_WEIGHTS, T0)).toBe(priorityScore(b.tasks[0], DEFAULT_WEIGHTS, T0));
  });

  it("締切が近いほど上位、完了は除外、Frog は未着手の重要タスク", () => {
    let s = addTask(emptyState(), { title: "遠い", deadline: at(60 * 24 * 30).toISOString() }, T0);
    s = addTask(s, { title: "近い", deadline: at(60).toISOString() }, T0);
    s = addTask(s, { title: "済", importance: 100 }, T0);
    s = completeTask(s, s.tasks[2].id, at(1));
    expect(rankTasks(s.tasks, DEFAULT_WEIGHTS, T0).map((t) => t.title)).toEqual(["近い", "遠い"]);
    s = addTask(s, { title: "重要", importance: 90 }, T0);
    expect(pickFrog(s.tasks, at(60))?.title).toBe("重要");
  });
});

describe("ルールベース分解", () => {
  it("勉強タスクはテキストを開くから始まる", () => {
    const d = ruleBasedDecompose("公認会計士試験の勉強をする");
    expect(d.source).toBe("rules");
    expect(d.firstAction).toContain("テキスト");
    expect(d.steps.length).toBeGreaterThan(2);
  });
  it("未知のタスクにも汎用の分解を返す", () => {
    expect(ruleBasedDecompose("確定申告").steps.length).toBeGreaterThan(0);
  });
});

describe("保存データの読み込み", () => {
  it("壊れたJSONや旧バージョンは初期状態にする", () => {
    expect(loadState("{oops").tasks).toEqual([]);
    expect(loadState(JSON.stringify({ version: 99 })).tasks).toEqual([]);
  });
  it("欠けた設定は初期値で補う", () => {
    const s = loadState(JSON.stringify({ version: 1, tasks: [], settings: { gamification: false } }));
    expect(s.settings.gamification).toBe(false);
    expect(s.settings.weights).toEqual(DEFAULT_WEIGHTS);
    expect(s.habits).toEqual([]);
  });
});
