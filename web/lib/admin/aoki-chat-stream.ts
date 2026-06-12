/**
 * 葵 chat ストリーミングの client ヘルパー (レビュー Phase 2-⑤ 第 1 弾、2026-06-12)
 *
 * /api/aoki-chat (NDJSON ストリーム) を読み、増分テキストを onDelta で逐次通知する。
 * grill 確定 (2026-06-12):
 * - 出始めるまでは呼び出し側が「考え中」を出す (onDelta が初めて呼ばれたら切り替え)
 * - 途中で切れたら出力済みテキストは捨てない → { text, errored: true } で返す
 *   (呼び出し側が「ごめん、途中で止まっちゃった」を続ける)
 */

import type { AokiChatInput } from "./aoki-chat-shared";

export type AokiStreamResult = {
  /** ここまでに出力された本文 (エラー時は途中まで) */
  text: string;
  /** 途中で切れた / サーバーがエラーを返した */
  errored: boolean;
};

export async function streamAokiChat(
  input: AokiChatInput,
  onDelta: (textSoFar: string) => void,
  signal?: AbortSignal,
): Promise<AokiStreamResult> {
  const res = await fetch("/api/aoki-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`aoki-chat stream failed: HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let errored = false;
  let done = false;

  const handleLine = (line: string) => {
    if (line.trim().length === 0) return;
    try {
      const ev = JSON.parse(line) as { t: string; text?: string };
      if (ev.t === "delta" && typeof ev.text === "string") {
        text += ev.text;
        onDelta(text);
      } else if (ev.t === "done") {
        done = true;
      } else if (ev.t === "error") {
        errored = true;
      }
    } catch {
      // 途中で切れた行 (接続断) は無視 — done が立たないので errored 扱いになる
    }
  };

  while (true) {
    const { value, done: readerDone } = await reader.read();
    if (readerDone) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      handleLine(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  if (buf.length > 0) handleLine(buf);

  // done を受け取らずにストリームが終わった = 接続が途中で切れた
  if (!done) errored = true;
  return { text, errored };
}
