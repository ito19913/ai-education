/**
 * 課題 chat ストリーミング Route Handler (レビュー Phase 2-⑤ 第 2 弾、2026-06-12)
 *
 * IssueChat (科目の先生との 1 件の課題を巡る対話) の Claude 言い換えをストリーミングで
 * 返す。reply の構造 (quickReplies / resolve シグナル) は client 側の mock
 * (prepareIssueChatReply) が同期で組み立て、text だけがここから流れる。
 * NDJSON の形式・切断時の扱いは lib/ai/stream-route.ts 参照。
 */

import { requireUser } from "@/lib/supabase/require-user";
import { MODEL_OPUS } from "@/lib/ai/client";
import { claudeTextStreamResponse } from "@/lib/ai/stream-route";
import {
  buildIssueChatRequest,
  type IssueChatClaudeInput,
} from "@/lib/learn/issue-chat-shared";

export const maxDuration = 120;

export async function POST(req: Request): Promise<Response> {
  try {
    await requireUser();
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let input: IssueChatClaudeInput;
  try {
    input = (await req.json()) as IssueChatClaudeInput;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { system, messages } = buildIssueChatRequest(input);
  return claudeTextStreamResponse({
    tag: "issue-chat",
    model: MODEL_OPUS,
    maxTokens: 600,
    system,
    messages,
  });
}
