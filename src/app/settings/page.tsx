"use client";

import Link from "next/link";
import { Badge, Button, Card, PageHeader, SectionTitle } from "@/components/ui";
import { DEFAULT_WEIGHTS } from "@/lib/domain/priority";
import type { PriorityWeights } from "@/lib/domain/types";
import { exportJson, resetAll, useAppState, useHydrated } from "@/lib/store";

const WEIGHT_LABEL: Record<keyof PriorityWeights, string> = {
  importance: "重要度",
  urgency: "緊急度",
  valueAlignment: "価値観との一致度",
  longTermImpact: "長期的影響",
  feasibility: "実行可能性",
};

/** 実装状況。未実装の機能を実装済みと表示しない（要件 28-12） */
const STATUS: { name: string; state: "done" | "partial" | "todo"; note?: string }[] = [
  { name: "タスク管理・3段階目標・30秒アクション", state: "done" },
  { name: "1タップ着手・集中タイマー・中断/復帰", state: "done" },
  { name: "行動できない理由 → 心理テクニック提示", state: "done", note: "静的カタログ" },
  { name: "if-then ルール・実行記録", state: "done" },
  { name: "極小習慣・実行記録", state: "done" },
  { name: "経験値・レベル（冪等付与）", state: "done" },
  { name: "日次・週次・月次の行動分析", state: "done" },
  { name: "AIタスク分解", state: "partial", note: "ANTHROPIC_API_KEY 設定時のみ。未設定時はルールベース" },
  { name: "Notion 知識の同期・RAG", state: "todo", note: "Phase 4。テクニック本文は未同期" },
  { name: "ユーザー認証・端末間同期（Supabase）", state: "todo", note: "現在はこの端末のブラウザ内にのみ保存" },
  { name: "オフライン（Service Worker）・Web Push 通知", state: "todo" },
  { name: "CBT思考記録・ACTワーク・価値観・ジャーナル", state: "todo", note: "Phase 2" },
  { name: "スキルツリー・クエスト・実績", state: "todo", note: "Phase 3" },
];

export default function SettingsPage() {
  const [s, dispatch] = useAppState();
  const hydrated = useHydrated();
  if (!hydrated) return <div className="h-64" />;

  const setSettings = (patch: Partial<typeof s.settings>) => dispatch((st) => ({ ...st, settings: { ...st.settings, ...patch } }));

  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `action-os-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="設定" />

      <Card className="md:hidden">
        <SectionTitle>その他の画面</SectionTitle>
        <div className="flex gap-2">
          <Link href="/rules" className="rounded-xl bg-zinc-100 px-4 py-2 text-sm dark:bg-zinc-800">if-then ルール</Link>
          <Link href="/stuck" className="rounded-xl bg-zinc-100 px-4 py-2 text-sm dark:bg-zinc-800">心理支援</Link>
        </div>
      </Card>

      <Card>
        <SectionTitle>表示</SectionTitle>
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>
            ゲーミフィケーション（レベル・XP表示）
            <span className="block text-xs text-zinc-500">オフにしても記録は続きます。XPは減りません。</span>
          </span>
          <input type="checkbox" className="size-5 accent-emerald-600" checked={s.settings.gamification} onChange={(e) => setSettings({ gamification: e.target.checked })} />
        </label>
      </Card>

      <Card>
        <SectionTitle>AI とプライバシー</SectionTitle>
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>
            AIタスク分解を使う（外部AIへ送信）
            <span className="block text-xs text-zinc-500">
              有効にすると、分解ボタンを押したときに「タスク名」と「詳細」だけを Anthropic の API に送信します。感情・心理の記録は送信しません。
            </span>
          </span>
          <input type="checkbox" className="size-5 accent-emerald-600" checked={s.settings.aiEnabled} onChange={(e) => setSettings({ aiEnabled: e.target.checked })} />
        </label>
      </Card>

      <Card>
        <SectionTitle aside={<Button variant="ghost" onClick={() => setSettings({ weights: { ...DEFAULT_WEIGHTS } })}>初期値に戻す</Button>}>優先度の重み</SectionTitle>
        <div className="grid gap-3">
          {(Object.keys(WEIGHT_LABEL) as (keyof PriorityWeights)[]).map((k) => (
            <label key={k} className="text-sm">
              <div className="flex justify-between">
                <span>{WEIGHT_LABEL[k]}</span>
                <span className="tabular-nums text-zinc-500">{s.settings.weights[k].toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.settings.weights[k]}
                onChange={(e) => setSettings({ weights: { ...s.settings.weights, [k]: Number(e.target.value) } })}
                className="w-full accent-emerald-600"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">合計が1でなくても、自動で正規化して計算します。</p>
      </Card>

      <Card>
        <SectionTitle>データ</SectionTitle>
        <p className="mb-3 text-sm text-zinc-500">
          データはこのブラウザの localStorage にのみ保存されています（暗号化なし・端末間同期なし）。ブラウザのデータを消すと失われるため、定期的なエクスポートをおすすめします。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download}>JSONでエクスポート</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("すべてのデータを完全に削除します。元に戻せません。よろしいですか？")) resetAll();
            }}
          >
            すべてのデータを削除
          </Button>
        </div>
      </Card>

      <Card>
        <SectionTitle>実装状況（MVP）</SectionTitle>
        <ul className="space-y-1.5 text-sm">
          {STATUS.map((x) => (
            <li key={x.name} className="flex items-start gap-2">
              <Badge tone={x.state === "done" ? "emerald" : x.state === "partial" ? "amber" : "zinc"}>
                {x.state === "done" ? "実装済" : x.state === "partial" ? "一部" : "未実装"}
              </Badge>
              <span>
                {x.name}
                {x.note && <span className="block text-xs text-zinc-500">{x.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-zinc-400">ACTION OS は医療的な診断や治療を行うものではありません。</p>
    </div>
  );
}
