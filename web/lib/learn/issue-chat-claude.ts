"use server";

/**
 * 課題 chat AI 応答 (B2、C76 2026-06-04)
 *
 * IssueChat (= 科目の先生との 1 件の課題を巡る対話) を Claude Opus 4.8 化。
 * 既存 buildNextIssueChatReply の reply 構造 (quickReplies / resolve signal) は
 * 維持しつつ、text 部分のみ Claude で書き換える post-process パターン。
 * 失敗時は mock text 維持で動線止めない。
 */

import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/supabase/require-user";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let cachedSystemPrompt: string | null = null;
function getSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const projectRoot = join(process.cwd(), "..");
  const philosophy = readFileSync(
    join(projectRoot, "PHILOSOPHY.md"),
    "utf-8",
  );
  cachedSystemPrompt = `あなたは科目の先生 (= ティーチング担当、葵あおい先生または他教科の先生)。
中学生・高校生 1 人と 1 件の課題 (= 分からない事 / 解けない問題) を巡って対話します。

## 役割の境界
- あなた = 教科の中身を教える、課題の核を引き出す → 一緒に解く
- ゆい先生 = コーチング担当、棲み分け
- 受動的補助 (A7): 本人の発話を起点に動く、押し付けない

## 応答スタイル
- 中学生・高校生に分かりやすい平易な言葉
- 答えだけ示さない、本人に考える余地を残す (ファインマン式)
- 短く 150-300 字
- markdown 使って OK

## プロジェクトの憲法 (PHILOSOPHY.md)

${philosophy}

応答テキストのみ、前置きなしで返してください。`;
  return cachedSystemPrompt;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.AI_EDU_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_EDU_ANTHROPIC_API_KEY is not set in .env.local (B2 issue-chat).",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export type IssueChatClaudeInput = {
  issueTitle: string;
  issueDetail?: string;
  subjectName: string;
  teacherName: string;
  userInput: string;
  fallbackText: string;
};

export async function issueChatRespondViaClaude(
  input: IssueChatClaudeInput,
): Promise<string> {
  await requireUser();
  const userMessage = `## 課題
タイトル: ${input.issueTitle}
${input.issueDetail ? `詳細: ${input.issueDetail}` : ""}

## 文脈
- 科目: ${input.subjectName}
- 先生: ${input.teacherName}

## mock 応答 (fallback、参考)
${input.fallbackText}

## ユーザーの今回の発話
「${input.userInput}」

## 指示
${input.teacherName} として、上記課題についての応答を生成してください。
mock 応答と同じ方向性 (= 次のアクション誘導 / quickReplies の文脈) を保ちつつ、
新 PHILOSOPHY (コーチング・ファースト型のティーチング = 受動的補助、ファインマン式)
整合の口調・文言で。応答テキストのみ。`;

  const res = await getClient().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 600,
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
    throw new Error("Claude returned no text block (B2 issue-chat).");
  }
  return textBlock.text;
}
