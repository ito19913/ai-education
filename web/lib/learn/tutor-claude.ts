"use server";

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Phase 6 smoke test: 「計画立てよう」入口の 1 発話だけを Claude Opus 4.7 で生成。
// NEXT_PUBLIC_USE_CLAUDE_API=true のときに tutor-mock の async wrapper からのみ呼ばれる。
// SSoT (TUTOR-ROLE.md + PHILOSOPHY.md) 全文を system に貼って prompt caching (ephemeral) で再利用。

let cachedSystemPrompt: string | null = null;
function getSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;

  // web/ から見たプロジェクトルートに SSoT 2 ファイルが置かれている
  const projectRoot = join(process.cwd(), "..");
  const tutorRole = readFileSync(
    join(projectRoot, "TUTOR-ROLE.md"),
    "utf-8",
  );
  const philosophy = readFileSync(
    join(projectRoot, "PHILOSOPHY.md"),
    "utf-8",
  );

  cachedSystemPrompt = `あなたはゆい先生 (担任 / コーチ)。中2の娘さん 1 人の学習を伴走します。応答は短く (200〜300 字程度)、温かく、コーチング軸を貫いてください。教科の内容は教えず、本人の「ふわっと」を質問で具体化していくスタンスです。

# 役割の定義 (TUTOR-ROLE.md)

${tutorRole}

# 勉強観の憲法 (PHILOSOPHY.md)

${philosophy}

# 今回の文脈

ユーザー (娘さん) が「計画立てよう」「計画立てる」等の発話をしました。UI 上では、あなたの応答の直後に科目を選ぶ Subject Picker カードが自動表示されます。応答 1 発話だけを返してください — 短く温かく、科目選びへ自然に誘導するメッセージ。発話本文のみ、説明や前置きなしで。`;

  return cachedSystemPrompt;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  // env 名は `AI_EDU_ANTHROPIC_API_KEY` を使う。Claude Code 等の親 harness が
  // 子プロセスに `ANTHROPIC_API_KEY=""` を inject するため、標準名だと dotenv の
  // 「既存 env を上書きしない」規律に巻き込まれて .env.local の値が無視される。
  const apiKey = process.env.AI_EDU_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_EDU_ANTHROPIC_API_KEY is not set in .env.local (Phase 6 smoke test).",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export async function tutorClaudeRespondToPlanRequest(
  userInput: string,
): Promise<string> {
  const res = await getClient().messages.create({
    model: "claude-opus-4-7",
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: getSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: userInput,
      },
    ],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block (Phase 6 smoke test).");
  }
  return textBlock.text;
}
