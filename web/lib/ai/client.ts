// Anthropic クライアントとモデル ID の唯一の置き場。
// 旧実装は 13 ファイルが同一の lazy singleton を重複定義し、モデル ID を 26 箇所に
// ハードコードしていた (2026-06-12 全体コードレビュー Phase 2 で集約)。
import Anthropic from "@anthropic-ai/sdk";

// モデルの使い分け: MODEL_OPUS = 子どもに見える発話・vision 読解などの本丸 /
// MODEL_HAIKU = 構造抽出・分類などの速度コスト優先タスク。
export const MODEL_OPUS = "claude-opus-4-8";
export const MODEL_HAIKU = "claude-haiku-4-5";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;
  // env 名は `AI_EDU_ANTHROPIC_API_KEY` を使う。Claude Code 等の親 harness が
  // 子プロセスに `ANTHROPIC_API_KEY=""` を inject するため、標準名だと dotenv の
  // 「既存 env を上書きしない」規律に巻き込まれて .env.local の値が無視される。
  const apiKey = process.env.AI_EDU_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI_EDU_ANTHROPIC_API_KEY is not set in .env.local");
  }
  client = new Anthropic({ apiKey });
  return client;
}
