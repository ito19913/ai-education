/**
 * 葵 chat ストリーミング Route Handler (レビュー Phase 2-⑤ 第 1 弾、2026-06-12)
 *
 * Server Action はストリーミング応答を返せないため、葵 chat (読書ビュー chat /
 * 「ここを解説」/ 宿題の問題解説 = 3 動線) はこの Route Handler 経由。
 * NDJSON の形式・切断時の扱いは lib/ai/stream-route.ts (共通ヘルパー) 参照。
 *
 * 認証は Server Action と同じ requireUser (Supabase cookie)。mock モード
 * (Supabase 未設定) はスキップされるが、API キーが無ければ 500 を返すだけで
 * client 側はエラー発話にフォールバックする。
 */

import { requireUser } from "@/lib/supabase/require-user";
import { MODEL_OPUS } from "@/lib/ai/client";
import { claudeTextStreamResponse } from "@/lib/ai/stream-route";
import {
  buildAokiChatRequest,
  type AokiChatInput,
} from "@/lib/ai/aoki-chat-shared";

// Vercel: ストリーミング中も関数が生きている必要がある。長い解説 + Opus の
// 生成時間を見込んで余裕を持たせる (ローカル dev では無視される)。
export const maxDuration = 120;

export async function POST(req: Request): Promise<Response> {
  try {
    await requireUser();
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let input: AokiChatInput;
  try {
    input = (await req.json()) as AokiChatInput;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { system, messages } = buildAokiChatRequest(input);
  return claudeTextStreamResponse({
    tag: "aoki-chat",
    model: MODEL_OPUS,
    maxTokens: 1000,
    system,
    messages,
  });
}
