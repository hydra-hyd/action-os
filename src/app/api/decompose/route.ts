import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * AIタスク分解。APIキーはサーバー側のみで扱う（ANTHROPIC_API_KEY 環境変数）。
 * 送信するのはタスク名と説明のみ。感情・思考記録は送らない。
 * 失敗時は 503 を返し、クライアントはルールベース分解にフォールバックする。
 */

const Input = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
});

const Output = z.object({
  firstAction: z.string(),
  steps: z.array(z.string()),
  goals: z.object({ minimum: z.string(), normal: z.string(), stretch: z.string() }),
});

const SYSTEM = `あなたは行動科学に基づくタスク分解アシスタントです。
ユーザーのタスクを、今すぐ実行できる具体的な行動に分解してください。
- firstAction: 30秒以内に実行できる最初の物理的な行動（例：テキストを開く、IDEを起動する）
- steps: 3〜7個。各ステップは具体的な動詞で始め、1つ15分以内で終わる大きさにする
- goals.minimum: 負担が少なく今日確実にできる最低目標
- goals.normal: 本来予定している通常目標
- goals.stretch: 余裕がある場合の発展目標
根性論や過度な負荷を求めないこと。日本語で簡潔に。`;

// 簡易レート制限（プロセス内・IP単位）
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "ai_not_configured" }, { status: 503 });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(Output) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `タスク名: ${parsed.data.title}\n詳細: ${parsed.data.description || "（なし）"}`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "ai_no_result" }, { status: 503 });
    }
    return Response.json({ ...response.parsed_output, source: "ai" });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "ai_rate_limited" }, { status: 503 });
    if (err instanceof Anthropic.AuthenticationError) return Response.json({ error: "ai_auth" }, { status: 503 });
    if (err instanceof Anthropic.APIError) return Response.json({ error: "ai_error" }, { status: 503 });
    return Response.json({ error: "ai_unavailable" }, { status: 503 });
  }
}
