"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "./ui";
import { goalHealth, HEALTH_LABEL, type Health } from "@/lib/domain/goals";
import type { AppState } from "@/lib/domain/types";

const TABS = [
  { href: "/goals", label: "ダッシュボード" },
  { href: "/goals/roadmap", label: "人生ロードマップ" },
  { href: "/goals/gantt", label: "ガント" },
  { href: "/goals/tree", label: "目標ツリー" },
  { href: "/goals/resources", label: "リソース・戦略参謀" },
  { href: "/goals/reviews", label: "定期レビュー" },
];

export function GoalsNav() {
  const path = usePathname().replace(/\/$/, "");
  return (
    <nav aria-label="目標管理" className="-mx-1 mb-4 flex gap-1 overflow-x-auto pb-1">
      {TABS.map((t) => {
        const active = path === t.href || path.endsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-sm ${
              active ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

const HEALTH_TONE: Record<Health, "zinc" | "emerald" | "amber" | "sky" | "rose"> = {
  ahead: "sky",
  on_track: "emerald",
  behind: "amber",
  overdue: "rose",
  unknown: "zinc",
  done: "emerald",
};

export function HealthBadge({ s, id, now }: { s: AppState; id: string; now: Date }) {
  const h = goalHealth(s, id, now);
  return <Badge tone={HEALTH_TONE[h]}>{HEALTH_LABEL[h]}</Badge>;
}

export function goalHref(id: string) {
  return `/goals/detail?id=${encodeURIComponent(id)}`;
}

export function pct(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`;
}
