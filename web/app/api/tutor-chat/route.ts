/**
 * ゆい chat ストリーミング Route Handler (レビュー Phase 2-⑤ 第 2 弾、2026-06-12)
 *
 * ゆいの Claude 言い換え (plan-request / scene 汎用 [day-start・day-close 含む]) を
 * ストリーミングで返す。reply の構造 (card / quickReplies / state 遷移) は client 側の
 * mock (prepareTutorReply) が同期で組み立て、text だけがここから流れる。
 * NDJSON の形式・切断時の扱いは lib/ai/stream-route.ts 参照。
 */

import { requireUser } from "@/lib/supabase/require-user";
import { MODEL_OPUS } from "@/lib/ai/client";
import { claudeTextStreamResponse } from "@/lib/ai/stream-route";
import {
  buildTutorChatRequest,
  type TutorClaudeRequest,
} from "@/lib/learn/tutor-chat-shared";

export const maxDuration = 120;

export async function POST(req: Request): Promise<Response> {
  try {
    await requireUser();
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let input: TutorClaudeRequest;
  try {
    input = (await req.json()) as TutorClaudeRequest;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { system, messages, maxTokens } = buildTutorChatRequest(input);
  return claudeTextStreamResponse({
    tag: "tutor-chat",
    model: MODEL_OPUS,
    maxTokens,
    system,
    messages,
  });
}
