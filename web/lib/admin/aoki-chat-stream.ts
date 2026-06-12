/**
 * 葵 chat ストリーミングの client ヘルパー (レビュー Phase 2-⑤ 第 1 弾、2026-06-12)
 *
 * NDJSON の読み取りは lib/ai/stream-client.ts (共通) に委譲。
 */

import { streamNdjsonText, type TextStreamResult } from "@/lib/ai/stream-client";
import type { AokiChatInput } from "./aoki-chat-shared";

export type AokiStreamResult = TextStreamResult;

export async function streamAokiChat(
  input: AokiChatInput,
  onDelta: (textSoFar: string) => void,
  signal?: AbortSignal,
): Promise<AokiStreamResult> {
  return streamNdjsonText("/api/aoki-chat", input, onDelta, signal);
}
