/**
 * AI テキストストリーミングの Route Handler 共通ヘルパー (server 専用)
 *
 * Claude の messages.stream() を NDJSON (1 行 1 JSON) で中継する Response を作る:
 *   {"t":"delta","text":"..."}  — 本文の増分
 *   {"t":"done"}                — 正常完了
 *   {"t":"error"}               — 途中エラー (出力済みの分は client 側で残す、grill Q3)
 *
 * client が切断 (画面遷移など) したら生成も abort する。完了時に logAiUsage で
 * キャッシュヒットを可視化。読み取りは lib/ai/stream-client.ts の streamNdjsonText。
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, logAiUsage } from "@/lib/ai/client";

export function claudeTextStreamResponse(args: {
  /** logAiUsage / エラーログ用のタグ (例: "aoki-chat") */
  tag: string;
  model: string;
  maxTokens: number;
  system: string | Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
}): Response {
  const encoder = new TextEncoder();
  const runner = getAnthropicClient().messages.stream({
    model: args.model,
    max_tokens: args.maxTokens,
    system: args.system,
    messages: args.messages,
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
        logAiUsage(args.tag, final.usage);
        send({ t: "done" });
      } catch (err) {
        // 途中エラー: client は出力済みの分を残して「途中で止まっちゃった」を足す
        console.error(`[${args.tag} stream] failed:`, err);
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
