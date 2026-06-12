/**
 * 葵 chat ストリーミング Route Handler (レビュー Phase 2-⑤ 第 1 弾、2026-06-12)
 *
 * Server Action はストリーミング応答を返せないため、葵 chat (読書ビュー chat /
 * 「ここを解説」/ 宿題の問題解説 = 3 動線) はこの Route Handler 経由に移行。
 * 応答は NDJSON (1 行 1 JSON):
 *   {"t":"delta","text":"..."}  — 本文の増分
 *   {"t":"done"}                — 正常完了
 *   {"t":"error"}               — 途中エラー (出力済みの分は client 側で残す、grill Q3)
 *
 * 認証は Server Action と同じ requireUser (Supabase cookie)。mock モード
 * (Supabase 未設定) はスキップされるが、API キーが無ければ 500 を返すだけで
 * client 側はエラー発話にフォールバックする。
 */

import { requireUser } from "@/lib/supabase/require-user";
import { getAnthropicClient, logAiUsage, MODEL_OPUS } from "@/lib/ai/client";
import {
  buildAokiChatRequest,
  type AokiChatInput,
} from "@/lib/admin/aoki-chat-shared";

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
  const encoder = new TextEncoder();

  const runner = getAnthropicClient().messages.stream({
    model: MODEL_OPUS,
    max_tokens: 1000,
    system,
    messages,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: { t: string; text?: string }) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        for await (const event of runner) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ t: "delta", text: event.delta.text });
          }
        }
        const final = await runner.finalMessage();
        logAiUsage("aoki-chat", final.usage);
        send({ t: "done" });
      } catch (err) {
        // 途中エラー: client は出力済みの分を残して「途中で止まっちゃった」を足す
        console.error("[aoki-chat stream] failed:", err);
        try {
          send({ t: "error" });
        } catch {
          // controller が既に閉じている (client 切断) 場合は無視
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      // client が切断 (画面遷移など) したら生成も止める
      runner.controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
