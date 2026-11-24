"use client";

import Link from "next/link";
import { useState } from "react";
import { GoalsNav, HealthBadge, goalHref, pct } from "@/components/goals";
import { Badge, Card, PageHeader, useNow } from "@/components/ui";
import { GOAL_STATUS_LABEL, childrenOf, goalProgress } from "@/lib/domain/goals";
import type { AppState, Goal } from "@/lib/domain/types";
import { useAppState, useHydrated } from "@/lib/store";

function Node({ s, g, now, depth, seen }: { s: AppState; g: Goal; now: Date; depth: number; seen: Set<string> }) {
  const [open, setOpen] = useState(depth < 2);
  if (seen.has(g.id)) return null;
  const nextSeen = new Set(seen).add(g.id);
  const kids = childrenOf(s, g.id);
  const ms = s.milestones.filter((m) => m.goalId === g.id);
  const tasks = s.tasks.filter((t) => t.goalId === g.id && !["done", "cancelled"].includes(t.status));
  const pr = goalProgress(s, g.id).value;
  const values = s.values.filter((v) => g.valueIds.includes(v.id));
  return (
    <li>
      <div className="flex items-start gap-2 rounded-xl p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
        <button
          type="button"
          className="mt-0.5 w-5 shrink-0 text-zinc-400"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "折りたたむ" : "展開する"}
          aria-expanded={open}
          disabled={kids.length === 0 && ms.length === 0 && tasks.length === 0}
        >
          {kids.length + ms.length + tasks.length > 0 ? (open ? "▾" : "▸") : "・"}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={goalHref(g.id)} className="font-medium hover:underline">{g.title}</Link>
            <HealthBadge s={s} id={g.id} now={now} />
            <Badge>{GOAL_STATUS_LABEL[g.status]}</Badge>
            {values.map((v) => (
              <Badge key={v.id} tone="sky">{v.name}</Badge>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 w-40 rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pr * 100}%` }} />
            </div>
            <span className="text-xs text-zinc-500">
              {pct(pr)}
              {g.dueDate && ` ・ ${g.dueDate}`} ・ 未完了タスク {tasks.length}
            </span>
          </div>
        </div>
      </div>
      {open && (
        <ul className="ml-5 border-l border-zinc-200 pl-3 dark:border-zinc-800">
          {kids.map((k) => (
            <Node key={k.id} s={s} g={k} now={now} depth={depth + 1} seen={nextSeen} />
          ))}
          {ms.map((m) => (
            <li key={m.id} className="py-0.5 pl-7 text-sm text-zinc-600 dark:text-zinc-400">
              {m.done ? "◆✓" : "◇"} {m.title}
              {m.dueDate && <span className="text-xs text-zinc-400"> （{m.dueDate}）</span>}
            </li>
          ))}
          {tasks.slice(0, 5).map((t) => (
            <li key={t.id} className="py-0.5 pl-7 text-sm text-zinc-500">
              □ {t.title}
              {t.firstAction && <span className="text-xs text-zinc-400"> → 最初の行動：{t.firstAction}</span>}
            </li>
          ))}
          {tasks.length > 5 && <li className="pl-7 text-xs text-zinc-400">ほか{tasks.length - 5}件</li>}
        </ul>
      )}
    </li>
  );
}

export default function TreePage() {
  const [s] = useAppState();
  const hydrated = useHydrated();
  const now = useNow(60_000);
  if (!hydrated) return <div className="h-64" />;
  const roots = s.goals.filter((g) => !g.parentId || !s.goals.some((p) => p.id === g.parentId));
  return (
    <div className="space-y-4">
      <PageHeader title="目標ツリー" sub="人生の方向性 → 長期目標 → 中期・短期目標 → マイルストーン → タスク → 最初の具体的行動。" />
      <GoalsNav />
      <Card>
        {roots.length === 0 ? (
          <p className="text-sm text-zinc-500">まだ目標がありません。</p>
        ) : (
          <ul>
            {roots.map((g) => (
              <Node key={g.id} s={s} g={g} now={now} depth={0} seen={new Set()} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
