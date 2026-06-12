/**
 * ゆい chat (Claude 言い換え) のプロンプト組み立て (ストリーミング化 2026-06-12、第 2 弾)
 *
 * 旧 tutor-claude.ts (Server Action 2 本: plan-request / scene 汎用) のロジックを移設。
 * Server Action はストリーミングを返せないため、呼び出しは Route Handler
 * (app/api/tutor-chat) に移行した。
 *
 * ★server 専用★: TUTOR-ROLE + PHILOSOPHY 全文を含むため client から値 import しない
 * (型だけなら `import type` で OK — コンパイル時に消える)。
 */

import type Anthropic from "@anthropic-ai/sdk";
import { PHILOSOPHY_MD, TUTOR_ROLE_MD } from "@/lib/ai/docs.generated";

/**
 * ゆい chat の Claude 呼び出し 1 回分のリクエスト。
 * - plan-request: 「計画立てよう」入口の 1 発話 (C56)
 * - scene: mock 発話を fallback として新 PHILOSOPHY 整合に言い換える汎用 (C73)。
 *   day-start / day-close (Phase B 儀式) もこの kind。
 */
export type TutorClaudeRequest =
  | { kind: "plan-request"; userInput: string }
  | {
      kind: "scene";
      scene: string;
      sceneContext: Record<string, unknown>;
      userInput?: string;
      fallbackText: string;
    };

let cachedSystemPrompt: string | null = null;
function getSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;

  cachedSystemPrompt = `あなたはゆい先生 (担任 / コーチ)。中2の娘さん 1 人の学習を伴走します。応答は短く (200〜300 字程度)、温かく、コーチング軸を貫いてください。教科の内容は教えず、本人の「ふわっと」を質問で具体化していくスタンスです。

# 役割の定義 (TUTOR-ROLE.md)

${TUTOR_ROLE_MD}

# 勉強観の憲法 (PHILOSOPHY.md)

${PHILOSOPHY_MD}

# 今回の文脈

ユーザー (娘さん) が「計画立てよう」「計画立てる」等の発話をしました。UI 上では、あなたの応答の直後に科目を選ぶ Subject Picker カードが自動表示されます。応答 1 発話だけを返してください — 短く温かく、科目選びへ自然に誘導するメッセージ。発話本文のみ、説明や前置きなしで。`;

  return cachedSystemPrompt;
}

export type TutorChatApiRequest = {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
  maxTokens: number;
};

/** ゆい chat の API リクエスト (system + messages) を組み立てる。 */
export function buildTutorChatRequest(
  req: TutorClaudeRequest,
): TutorChatApiRequest {
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: getSystemPrompt(),
      cache_control: { type: "ephemeral" },
    },
  ];

  if (req.kind === "plan-request") {
    return {
      system,
      maxTokens: 512,
      messages: [{ role: "user", content: req.userInput }],
    };
  }

  // C73 シーン汎用: mock 発話 + 場面 context (JSON) + 新キャラ・新方針指示
  const userMessage = `## 現在の場面
シーン識別子: ${req.scene}

## ベースとなる mock 発話 (= fallback、参考にする)
${req.fallbackText}

## 場面固有の状況 (JSON)
${JSON.stringify(req.sceneContext, null, 2)}
${
  req.userInput
    ? `

## ユーザーの直前発話
「${req.userInput}」`
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

  return {
    system,
    maxTokens: 700,
    messages: [{ role: "user", content: userMessage }],
  };
}
