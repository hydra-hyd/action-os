"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "ホーム", icon: "⌂" },
  { href: "/tasks", label: "タスク", icon: "☰" },
  { href: "/focus", label: "集中", icon: "◉" },
  { href: "/habits", label: "習慣", icon: "✓" },
  { href: "/rules", label: "if-then", icon: "⇢" },
  { href: "/stuck", label: "心理支援", icon: "♡" },
  { href: "/analytics", label: "分析", icon: "▤" },
  { href: "/settings", label: "設定", icon: "⚙" },
];

const MOBILE = ["/", "/tasks", "/focus", "/habits", "/analytics"];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <nav aria-label="メイン" className="fixed inset-y-0 left-0 hidden w-52 flex-col border-r border-zinc-200 bg-white px-3 py-5 md:flex dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6 px-3 text-lg font-bold tracking-tight">
          ACTION <span className="text-emerald-600">OS</span>
        </div>
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
              active(i.href)
                ? "bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            <span aria-hidden className="w-4 text-center">{i.icon}</span>
            {i.label}
          </Link>
        ))}
        <p className="mt-auto px-3 text-[11px] leading-relaxed text-zinc-400">
          MVP版・データはこの端末内にのみ保存されます
        </p>
      </nav>
      <nav aria-label="メイン（モバイル）" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
        {ITEMS.filter((i) => MOBILE.includes(i.href)).map((i) => (
          <Link key={i.href} href={i.href} className={`flex flex-col items-center py-2 text-[11px] ${active(i.href) ? "text-emerald-600" : "text-zinc-500"}`}>
            <span aria-hidden className="text-base">{i.icon}</span>
            {i.label}
          </Link>
        ))}
        <Link href="/settings" className={`flex flex-col items-center py-2 text-[11px] ${active("/settings") || active("/rules") || active("/stuck") ? "text-emerald-600" : "text-zinc-500"}`}>
          <span aria-hidden className="text-base">⋯</span>
          その他
        </Link>
      </nav>
    </>
  );
}
