"use server";

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Phase 6 smoke test (C56): 「計画立てよう」入口の 1 発話だけを Claude Opus 4.8 で生成。
// C73 (2026-06-04): シーン汎用 tutorClaudeRespondToScene を追加。mock 発話を fallback として
// Claude に渡し、新 PHILOSOPHY (コーチング・ファースト型) 整合に言い換えてもらうパターン。
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
    model: "claude-opus-4-8",
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

/**
 * C73 (2026-06-04): シーン汎用 Claude 応答。
 *
 * mock 発話を fallback として Claude に渡し、新 PHILOSOPHY (コーチング・ファースト型 + 親⇄ゆい対話)
 * 整合の口調・文言で言い換えてもらう。シーンごとに固有指示を書く必要を最小化し、
 * 「mock 発話 + 場面 context (JSON) + 新キャラ・新方針指示」だけで Claude に応答させる。
 *
 * 呼び出し元: tutor-mock.ts の buildNextTutorReplyAsync。
 * 失敗時は呼び出し元で mock fallback (動線止めない、C56 と同規律)。
 */
export async function tutorClaudeRespondToScene(args: {
  /** シーン識別子 (例: "plan-after-subject", "evening-period-count", "ending-vent") */
  scene: string;
  /** 場面固有の状況 (JSON で渡せる plain object) */
  sceneContext: Record<string, unknown>;
  /** ユーザーの直前発話 (任意) */
  userInput?: string;
  /** mock の発話文 (= fallback、Claude に「これを温かく言い換えて」と参照させる) */
  fallbackText: string;
}): Promise<string> {
  const userMessage = `## 現在の場面
シーン識別子: ${args.scene}

## ベースとなる mock 発話 (= fallback、参考にする)
${args.fallbackText}

## 場面固有の状況 (JSON)
${JSON.stringify(args.sceneContext, null, 2)}
${
  args.userInput
    ? `

## ユーザーの直前発話
「${args.userInput}」`
    : ""
}

## 指示
上記の場面で、ゆい先生として応答してください。
- 新 PHILOSOPHY (コーチング・ファースト型) のゆいキャラを保ち、温かく、200-300 字程度
- 場面固有の状況 (JSON) を参考に、具体的な情報 (科目名 / 教材名 / 期間 / 弱いところ件数 / 時限数 等) を本文に自然に織り込む
- mock 発話と同じ「次のアクション誘導」(= subject → material → duration → 確定 / 時限別ヒアリング / 振り返り → 課題 → タスク開始 等) を保ちつつ、口調と文言を新 PHILOSOPHY 整合に
- D2-5 (親通知の透明性) が必要な場面 (= 計画立案完了 / Replan 完了 等) は「お母さん・お父さんにも伝えたよ ✉️ もし違うかなと思うところがあれば 24 時間以内に異議来るね」相当の文を含める
- 余計な前置きや説明なし、応答テキストのみを返してください (markdown はそのまま使って OK)

ゆいの応答:`;

  const res = await getClient().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 700,
    system: [
      {
        type: "text",
        text: getSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block (C73 scene generic).");
  }
  return textBlock.text;
}
