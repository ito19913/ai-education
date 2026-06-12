/**
 * 課題（Issue）chat の科目の先生 mock（Phase 3）。
 *
 * 科目の先生 persona で、課題 1 件を巡る scripted な対話を返す。
 * Phase 6 で Claude API に置き換える前提の簡易状態機械。
 *
 * 設計判断（ARCHITECTURE §課題 chat 統合 参照）:
 * - クリア導線は「分かった！」ボタン + 「クリアして」発話の両方有効
 * - AI 発の Issue は初手で trigger-message-quote カードを置く
 * - 本人発の Issue は初手でテキスト発話のみ
 * - クリア用 keyword は厳密に判定（誤クリア防止）
 */
import type { ChatMessage, Issue, IssueChatMessage } from "./types";
import type { IssueChatClaudeInput } from "./issue-chat-shared";

/** 科目の先生（英語担当）の persona。表示用の固定情報は MOCK_SUBJECTS[0].teacher に集約済み */
export const SUBJECT_TEACHER_PERSONA = {
  name: "あおい",
  displayName: "あおい先生",
  description:
    "教科の専門家。理屈と例で教える。砕けすぎず、固すぎず。説明は短く、本人に考えさせる余白を残す。",
  avatarLetter: "あ",
  subtitle: "英語の先生",
} as const;

export type IssueChatStep = {
  issueId: string;
  /** 1 件の課題内のターン数（mock のスクリプト分岐に使う）*/
  turnCount: number;
};

function makeId(): string {
  return `ic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 課題 chat の初手 AI 発話を生成する。
 * chatThread が空の Issue を開いた時に呼ばれる。
 *
 * AI 発の Issue は trigger-message-quote カード + 本文の 2 通、
 * 本人発の Issue はテキスト 1 通。
 */
export function buildInitialIssueChat(args: {
  issue: Issue;
  /** AI 発の場合の検知元 ChatMessage（あれば引用カードに使う）*/
  triggerMessage?: ChatMessage;
}): IssueChatMessage[] {
  const { issue, triggerMessage } = args;
  const now = new Date().toISOString();

  if (issue.source === "ai-detected" && triggerMessage) {
    return [
      {
        id: makeId(),
        issueId: issue.id,
        role: "teacher",
        card: {
          kind: "trigger-message-quote",
          sourceMessageId: triggerMessage.id,
          sourceNodeId: triggerMessage.nodeId,
          quote: triggerMessage.content,
          sourceCreatedAt: triggerMessage.createdAt,
        },
        createdAt: now,
      },
      {
        id: makeId(),
        issueId: issue.id,
        role: "teacher",
        text: `あの時の会話、こんな感じだったよね。\n${issue.detail ?? "ちょっと届いてなさそうだったから、もう一度確認してみる?"}`,
        quickReplies: ["確認したい", "ヒントほしい", "もう大丈夫"],
        createdAt: now,
      },
    ];
  }

  // AI 発だが triggerMessage が見つからなかった場合（fallback）
  if (issue.source === "ai-detected") {
    return [
      {
        id: makeId(),
        issueId: issue.id,
        role: "teacher",
        text: `「${issue.title}」について確認したい、って AI 側で挙げてあった件だね。\n${issue.detail ?? "もう一度確認してみよっか?"}`,
        quickReplies: ["確認したい", "ヒントほしい", "もう大丈夫"],
        createdAt: now,
      },
    ];
  }

  // 本人発の Issue
  return [
    {
      id: makeId(),
      issueId: issue.id,
      role: "teacher",
      text: `これ、自分でメモしてくれてたやつだね。\n「${issue.title}」\n${issue.detail ? `\n${issue.detail}\n` : ""}\nどのあたりで詰まってる感じ?`,
      quickReplies: ["分からない", "例で考えたい", "もう少し詳しく"],
      createdAt: now,
    },
  ];
}

/** クリア意思を表す発話の keyword 判定（mock では厳密目に）*/
function isResolveSignal(lower: string): boolean {
  // 「クリアして」「クリアでお願い」など明示的な指示
  if (lower.includes("クリア")) return true;
  // 「もう大丈夫」「もう平気」
  if (lower.includes("もう大丈夫") || lower.includes("もう平気")) return true;
  // 「だいたい分かった」「ばっちり」
  if (lower.includes("だいたい分かった") || lower.includes("ばっちり")) return true;
  return false;
}

/**
 * 次の AI 応答を生成する scripted ジェネレーター。
 * shouldResolve = true の時、親（TutorWorkspace / IssueChat）が Issue.status を resolved に更新する。
 */
export function buildNextIssueChatReply(args: {
  state: IssueChatStep;
  issue: Issue;
  userInput: string;
}): {
  reply: IssueChatMessage;
  nextState: IssueChatStep;
  /** true なら親側で Issue を resolved に更新する */
  shouldResolve?: boolean;
} {
  const { state, issue, userInput } = args;
  const lower = userInput.toLowerCase().trim();
  const now = new Date().toISOString();

  // --- クリア発話: 確認 + resolve シグナル ---
  if (isResolveSignal(lower)) {
    return {
      nextState: { ...state, turnCount: state.turnCount + 1 },
      shouldResolve: true,
      reply: {
        id: makeId(),
        issueId: issue.id,
        role: "teacher",
        text: "OK、クリアしておくね。お疲れさま！\nまた似た問題で詰まったら、いつでも呼んで。",
        createdAt: now,
      },
    };
  }

  // --- 「分からない」系: 一段ヒント ---
  if (
    lower.includes("分からない") ||
    lower.includes("わからない") ||
    lower.includes("わかんない") ||
    lower.includes("ヒント")
  ) {
    return {
      nextState: { ...state, turnCount: state.turnCount + 1 },
      reply: {
        id: makeId(),
        issueId: issue.id,
        role: "teacher",
        text: `OK、ヒントね。\n${issue.detail ?? issue.title}について、まず「ここまではわかる」「ここからわからない」の境目を一緒に探そう。\n何ならわかる?`,
        quickReplies: ["訳ならわかる", "形ならわかる", "全部わからない"],
        createdAt: now,
      },
    };
  }

  // --- 「例えば」「例で」系: 例文を提示 ---
  if (lower.includes("例") || lower.includes("たとえ")) {
    return {
      nextState: { ...state, turnCount: state.turnCount + 1 },
      reply: {
        id: makeId(),
        issueId: issue.id,
        role: "teacher",
        text: `例で行こう。\n「${issue.title}」に関連する例を 1 つ。\n\n（mock: ここは Phase 6 で実 LLM が文脈に応じて生成）\n\nこの例、しっくりくる?`,
        quickReplies: ["なるほど", "もう一個ほしい", "まだ曖昧"],
        createdAt: now,
      },
    };
  }

  // --- 「もっと詳しく」「もう少し」系 ---
  if (
    lower.includes("詳しく") ||
    lower.includes("もう少し") ||
    lower.includes("もっと")
  ) {
    return {
      nextState: { ...state, turnCount: state.turnCount + 1 },
      reply: {
        id: makeId(),
        issueId: issue.id,
        role: "teacher",
        text: `もう少し掘ろう。\n${issue.detail ? `背景としては、${issue.detail}` : "この課題の核を一言で言うと、ちょっと整理しよう。"}\n\nどこから掘る?`,
        quickReplies: ["もっと例ほしい", "理屈を聞きたい", "もう大丈夫"],
        createdAt: now,
      },
    };
  }

  // --- 「もう一回」「繰り返し」 ---
  if (lower.includes("もう一回") || lower.includes("繰り返")) {
    return {
      nextState: { ...state, turnCount: state.turnCount + 1 },
      reply: {
        id: makeId(),
        issueId: issue.id,
        role: "teacher",
        text: "OK、もう一回ね。\n（mock: 直前の説明を別の言い方で）\nどう、今度はしっくりきた?",
        quickReplies: ["うん", "まだピンとこない", "もう大丈夫"],
        createdAt: now,
      },
    };
  }

  // --- fallback: 受け止め + 次の問い ---
  return {
    nextState: { ...state, turnCount: state.turnCount + 1 },
    reply: {
      id: makeId(),
      issueId: issue.id,
      role: "teacher",
      text: "なるほど、聞かせてくれてありがとう。\nそしたら次、もう一歩進めよう。\nこの課題、いま自分でどこまで言葉にできそう?",
      quickReplies: ["説明してみる", "ヒントほしい", "もう大丈夫"],
      createdAt: now,
    },
  };
}

/**
 * ストリーミング化 (2026-06-12、第 2 弾): Claude を呼ばずに「reply 構造 + Claude に
 * 投げるリクエスト」を同期で返す。呼び出し元 (IssueChat) が /api/issue-chat へ
 * ストリーミングで投げ、text だけを逐次表示→確定置換する。
 *
 * 旧 buildNextIssueChatReplyAsync (B2 C76、Server Action で全文待ち) の置き換え。
 * resolve シグナル (= 「クリア」発話) と quickReplies は mock のまま維持。
 * claude: null なら Claude 対象外 (flag off / resolve 発話) = mock のまま即表示。
 * ストリーム失敗時の fallback は呼び出し元が reply.text (= mock 文) を維持する。
 */
export function prepareIssueChatReply(args: {
  state: IssueChatStep;
  issue: Issue;
  userInput: string;
  subjectName?: string;
  teacherName?: string;
}): {
  result: {
    reply: IssueChatMessage;
    nextState: IssueChatStep;
    shouldResolve?: boolean;
  };
  claude: IssueChatClaudeInput | null;
} {
  const result = buildNextIssueChatReply({
    state: args.state,
    issue: args.issue,
    userInput: args.userInput,
  });
  const useClaude = process.env.NEXT_PUBLIC_USE_CLAUDE_API === "true";
  if (!useClaude || result.shouldResolve) return { result, claude: null };
  return {
    result,
    claude: {
      issueTitle: args.issue.title,
      issueDetail: args.issue.detail,
      subjectName: args.subjectName ?? "教科",
      teacherName: args.teacherName ?? SUBJECT_TEACHER_PERSONA.displayName,
      userInput: args.userInput,
      fallbackText: result.reply.text ?? "",
    },
  };
}
