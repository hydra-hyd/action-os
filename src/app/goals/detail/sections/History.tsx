"use client";

import { Button, Card, SectionTitle } from "@/components/ui";
import { GOAL_STATUS_LABEL, restorePlanVersion } from "@/lib/domain/goals";
import type { SectionProps } from "./types";

export function HistorySection({ s, dispatch, goal }: SectionProps) {
  const versions = s.planVersions.filter((v) => v.goalId === goal.id).reverse();
  const currentMs = s.milestones.filter((m) => m.goalId === goal.id);
  return (
    <Card>
      <SectionTitle>計画の変更履歴</SectionTitle>
      <p className="mb-3 text-xs text-zinc-500">期限の変更、プランの切り替え、戦略の採用、逆算計画の反映の前に、その時点の計画を自動で保存しています。</p>
      <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm dark:bg-emerald-900/30">
        <div className="font-medium">現在</div>
        期限 {goal.dueDate ?? "未設定"} ・ {GOAL_STATUS_LABEL[goal.status]} ・ プラン{goal.activePlan.toUpperCase()} ・ マイルストーン{currentMs.length}件
      </div>
      {versions.length === 0 ? (
        <p className="text-sm text-zinc-500">まだ履歴はありません。</p>
      ) : (
        <ol className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums text-zinc-500">{new Date(v.at).toLocaleString("ja-JP")}</span>
                <span className="font-medium">{v.reason}</span>
                <Button
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => confirm("この時点の計画（目標の設定とマイルストーン）に戻しますか？現在の計画も履歴に保存されます。") && dispatch((st) => restorePlanVersion(st, v.id))}
                >
                  この時点に戻す
                </Button>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                変更前：期限 {v.snapshot.goal.dueDate ?? "未設定"} ・ {GOAL_STATUS_LABEL[v.snapshot.goal.status]} ・ プラン{v.snapshot.goal.activePlan.toUpperCase()} ・ マイルストーン{v.snapshot.milestones.length}件
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
