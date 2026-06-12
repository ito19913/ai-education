/**
 * 課題 chat (B2) のプロンプト組み立て (ストリーミング化 2026-06-12、第 2 弾)
 *
 * 旧 issue-chat-claude.ts (Server Action) のロジックを移設。Server Action は
 * ストリーミングを返せないため、呼び出しは Route Handler (app/api/issue-chat) に移行した。
 *
 * ★server 専用★: PHILOSOPHY 全文を含むため client から値 import しない
 * (型だけなら `import type` で OK)。
 */

import type Anthropic from "@anthropic-ai/sdk";
import { PHILOSOPHY_MD } from "@/lib/ai/docs.generated";

export type IssueChatClaudeInput = {
  issueTitle: string;
  issueDetail?: string;
  subjectName: string;
  teacherName: string;
  userInput: string;
  fallbackText: string;
};

let cachedSystemPrompt: string | null = null;
function getSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
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

${PHILOSOPHY_MD}

応答テキストのみ、前置きなしで返してください。`;
  return cachedSystemPrompt;
}

export type IssueChatApiRequest = {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
};

/** 課題 chat の API リクエスト (system + messages) を組み立てる。 */
export function buildIssueChatRequest(
  input: IssueChatClaudeInput,
): IssueChatApiRequest {
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

  return {
    system: [
      {
        type: "text",
        text: getSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  };
}
