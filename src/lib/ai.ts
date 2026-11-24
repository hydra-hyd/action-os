import { ruleBasedDecompose, type Decomposition } from "./domain/decompose";

/**
 * タスク分解。AI 送信が許可されていれば /api/decompose を呼び、
 * 使えない場合はルールベースにフォールバックする（結果の source で区別）。
 */
export async function decomposeTask(title: string, description: string, aiEnabled: boolean): Promise<Decomposition & { aiError?: string }> {
  if (!aiEnabled) return ruleBasedDecompose(title);
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/decompose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ...ruleBasedDecompose(title), aiError: String(data.error ?? res.status) };
    return { ...data, source: "ai" } as Decomposition;
  } catch {
    return { ...ruleBasedDecompose(title), aiError: "network" };
  }
}

export const AI_ERROR_LABEL: Record<string, string> = {
  ai_not_configured: "AIは未設定です（サーバーに ANTHROPIC_API_KEY がありません）",
  ai_rate_limited: "AIの利用制限に達しました",
  ai_auth: "AIの認証に失敗しました",
  rate_limited: "短時間に呼び出しが多すぎます",
  network: "オフラインまたは通信エラー",
  "404": "この公開版ではAI機能を利用できません",
  "405": "この公開版ではAI機能を利用できません",
};
