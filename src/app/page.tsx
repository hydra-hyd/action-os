"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, ProgressBar, SectionTitle, Stat, inputClass, useNow } from "@/components/ui";
import { activeFocus, addTask, logHabit, startTask } from "@/lib/domain/actions";
import { ruleBasedDecompose } from "@/lib/domain/decompose";
import { completionRate, focusMs, formatRate, habitRate, habitStreakInfo, startRate } from "@/lib/domain/kpi";
import { OPEN_STATUSES, goalHealth, goalPath } from "@/lib/domain/goals";
import { pickFrog, rankTasks } from "@/lib/domain/priority";
import { REVIEW_LABEL, dueReviews } from "@/lib/domain/reviews";
import { TASK_STATUS_LABEL } from "@/lib/domain/types";
import { formatDuration, startOfWeek } from "@/lib/domain/util";
import { levelInfo, levelTitle, totalXp } from "@/lib/domain/xp";
import { useAppState, useHydrated } from "@/lib/store";

export default function Home() {
  const [s, dispatch] = useAppState();
  const hydrated = useHydrated();
  const now = useNow(30_000);
  const router = useRouter();
  const [quick, setQuick] = useState("");

  if (!hydrated) return <div className="h-64" />;

  const ranked = rankTasks(s.tasks, s.settings.weights, now);
  const doing = s.tasks.find((t) => t.status === "doing");
  const top = doing ?? ranked[0];
  const frog = pickFrog(s.tasks, now);
  const resumable = s.tasks.filter((t) => t.status === "interrupted" || t.status === "paused");
  const focus = activeFocus(s);

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = { from: dayStart, to: new Date(dayStart.getTime() + 86400000) };
  const week = { from: startOfWeek(now), to: new Date(startOfWeek(now).getTime() + 7 * 86400000) };
  const xp = totalXp(s.xpLogs);
  const lv = levelInfo(xp);
  const topGoal = top?.goalId ? s.goals.find((g) => g.id === top.goalId) : undefined;
  const topMilestone = top?.milestoneId ? s.milestones.find((m) => m.id === top.milestoneId) : undefined;
  const reviewsDue = s.goals.length > 0 ? dueReviews(s, now).filter((k) => k !== "daily") : [];
  const behindGoals = s.goals.filter((g) => OPEN_STATUSES.includes(g.status) && ["behind", "overdue"].includes(goalHealth(s, g.id, now)));
  const habits = s.habits.filter((h) => !h.archived && (h.weekdays.length === 0 || h.weekdays.includes(now.getDay())));

  const go = () => {
    if (!top) return;
    if (top.status !== "doing" || !focus) dispatch((st) => startTask(st, top.id));
    router.push("/focus");
  };

  const quickAdd = () => {
    const title = quick.trim();
    if (!title) return;
    const d = ruleBasedDecompose(title);
    dispatch((st) =>
      addTask(st, {
        title,
        firstAction: d.firstAction,
        goals: d.goals,
        plannedStart: new Date().toISOString(),
      }),
    );
    setQuick("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-zinc-500">
            {now.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}{" "}
            {now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">次の一歩</h1>
        </div>
        {s.settings.gamification && (
          <div className="w-40 text-right">
            <div className="text-xs text-zinc-500">
              Lv.{lv.level} {levelTitle(lv.level)}
            </div>
            <ProgressBar value={lv.current} max={lv.needed} />
            <div className="mt-0.5 text-[11px] text-zinc-400 tabular-nums">
              {lv.current}/{lv.needed} XP（累計 {xp}）
            </div>
          </div>
        )}
      </div>

      <Card className="border-emerald-200 dark:border-emerald-900">
        {top ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {top.isMostImportant && <Badge tone="emerald">本日の最重要</Badge>}
              <Badge>{TASK_STATUS_LABEL[top.status]}</Badge>
            </div>
            <h2 className="mt-2 text-xl font-semibold">{top.title}</h2>
            {topGoal && (
              <p className="mt-1 text-sm text-zinc-500">
                ◎ 目標：
                <Link href={`/goals/detail?id=${topGoal.id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">
                  {goalPath(s, topGoal.id).map((g) => g.title).join(" › ")}
                </Link>
                {topMilestone && ` ・ ${topMilestone.title}`}
              </p>
            )}
            <p className="mt-2 text-sm text-zinc-500">最初の30秒でやること</p>
            <p className="text-lg font-medium">{top.nextAction || top.firstAction || "必要なものを1つ手元に出す"}</p>
            {top.goals.minimum && <p className="mt-1 text-sm text-zinc-500">最低目標：{top.goals.minimum}</p>}
          </>
        ) : (
          <p className="text-zinc-500">
            {s.tasks.some((t) => t.status === "done" || t.status === "minimum_done")
              ? "進行中のタスクはありません。休むのも、次の1つを書くのもOKです。"
              : "まだタスクがありません。下の入力欄に1つだけ書いてみましょう。"}
          </p>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="primary" className="min-h-14 text-base" onClick={go} disabled={!top}>
            ▶ 今すぐ行動する
          </Button>
          <Link
            href={top ? `/stuck?task=${top.id}` : "/stuck"}
            className="inline-flex min-h-14 items-center justify-center rounded-xl bg-amber-100 px-4 text-base font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100"
          >
            行動できない・気が進まない
          </Link>
        </div>
      </Card>

      <Card>
        <SectionTitle>タスクを1つ書く</SectionTitle>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            quickAdd();
          }}
        >
          <input className={inputClass} placeholder="例：簿記の問題を解く" value={quick} onChange={(e) => setQuick(e.target.value)} aria-label="タスク名" />
          <Button type="submit" variant="secondary">追加</Button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">最初の行動と最低目標はルールベースで自動入力されます。タスク画面で編集できます。</p>
      </Card>

      {(behindGoals.length > 0 || reviewsDue.length > 0) && (
        <Card>
          <SectionTitle aside={<Link href="/goals" className="text-xs text-emerald-700 dark:text-emerald-400">目標管理</Link>}>長期目標</SectionTitle>
          <ul className="space-y-1 text-sm">
            {behindGoals.slice(0, 3).map((g) => (
              <li key={g.id}>
                <Link href={`/goals/detail?id=${g.id}&tab=forecast`} className="hover:underline">
                  「{g.title}」が計画より遅れています。原因（気持ち・計画・時間）を確認する →
                </Link>
              </li>
            ))}
            {reviewsDue.map((k) => (
              <li key={k}>
                <Link href="/goals/reviews" className="hover:underline">{REVIEW_LABEL[k]}レビューの時期です →</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {resumable.length > 0 && (
        <Card>
          <SectionTitle>中断中のタスク（復帰モード）</SectionTitle>
          <ul className="space-y-2">
            {resumable.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
                <div className="min-w-0">
                  <div className="truncate font-medium">{t.title}</div>
                  <div className="truncate text-xs text-zinc-500">
                    次の行動：{t.nextAction || t.firstAction || "未設定"}
                    {t.progressNote && ` ／ 前回：${t.progressNote}`}
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => {
                    dispatch((st) => startTask(st, t.id));
                    router.push("/focus");
                  }}
                >
                  再開
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {frog && frog.id !== top?.id && (
        <Card>
          <SectionTitle>Eat That Frog（重要で先延ばし中）</SectionTitle>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-medium">{frog.title}</div>
              <div className="text-xs text-zinc-500">最初の行動：{frog.firstAction || "未設定"}</div>
            </div>
            <Link href={`/stuck?task=${frog.id}`} className="text-sm text-emerald-700 underline dark:text-emerald-400">
              小さく始める
            </Link>
          </div>
        </Card>
      )}

      {habits.length > 0 && (
        <Card>
          <SectionTitle aside={<Link href="/habits" className="text-xs text-emerald-700 dark:text-emerald-400">すべて</Link>}>今日の習慣</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {habits.map((h) => {
              const info = habitStreakInfo(s, h.id, now);
              return (
                <li key={h.id}>
                  <Button
                    variant={info.doneToday ? "primary" : "secondary"}
                    onClick={() => dispatch((st) => logHabit(st, h.id, "minimum"))}
                    aria-pressed={info.doneToday}
                  >
                    {info.doneToday ? "✓ " : ""}
                    {h.name}
                    <span className="text-xs opacity-70">（最低：{h.minimum}）</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle aside={<Link href="/analytics" className="text-xs text-emerald-700 dark:text-emerald-400">詳しく</Link>}>実績</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="今日の完了率" value={formatRate(completionRate(s, today))} />
          <Stat label="今日の習慣実行率" value={formatRate(habitRate(s, today, now))} />
          <Stat label="今週の着手率" value={formatRate(startRate(s, week))} />
          <Stat label="今週の集中時間" value={formatDuration(focusMs(s, week, now))} />
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">率は「行動予定時刻」を設定したタスクが対象です。</p>
      </Card>
    </div>
  );
}
