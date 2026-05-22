/**
 * 担任の先生「ゆい」さん（mock）の人格と、初回会話の雛形。
 *
 * Phase 2 では Claude API 接続はせず、scripted conversation で
 * 「リッチカードが埋め込まれる」体験を見せる。本人が typed input すると
 * 次のスクリプトに進む（または quickReply ボタンで即進める）。
 *
 * Phase 3+ で Claude API に接続し、文脈に応じた応答に置き換える。
 */
import type { TutorMessage, TutorThread } from "./types";

/** 担任の persona（system prompt の元になる）*/
export const TUTOR_PERSONA = {
  name: "ゆい",
  /** 20代前半の女性チューター。フランク敬語ベース。 */
  description:
    "20代前半の女性チューター。東進ハイスクールのチューター的存在。教えるのは科目の先生に任せ、自分は生徒の生活・気分・スケジュール・モチベを横断的に見る。「〜だよ」「〜してみる?」「了解!」「そっか」みたいな砕けた口調。距離が近め、感情の話もしやすい。",
  avatarLetter: "ゆ",
  /** ヘッダー等で使うサブタイトル */
  subtitle: "担任の先生（チューター）",
} as const;

/**
 * 初回ログイン時の挨拶メッセージ。
 * mock では「今 = 夕方」と仮定したスクリプトを使う。
 */
export function buildInitialTutorThread(now: Date = new Date()): TutorThread {
  const hour = now.getHours();
  const greeting =
    hour < 11
      ? "おはよう！"
      : hour < 17
        ? "おかえり！"
        : hour < 22
          ? "おかえり〜、お疲れさま。"
          : "もうこんな時間か。来てくれてありがとう。";

  const messages: TutorMessage[] = [
    {
      id: "t-1",
      role: "tutor",
      text: `${greeting} 今日はどんな一日だった？\n\n勉強の話でも、学校でのことでも、なんでも聞くよ。話すと頭の中が整理されるから、ちょっと一言からでも OK。`,
      quickReplies: [
        "ふつうかな",
        "ちょっと疲れた",
        "イヤなことあった",
        "今日いい感じ",
      ],
      createdAt: now.toISOString(),
    },
  ];

  return {
    id: "tutor-thread-default",
    learnerId: "girl",
    messages,
  };
}

/**
 * scripted な「次の発話」を返す関数。
 * 本人の入力 / quickReply の選択に応じて、次の AI 応答を組み立てる。
 *
 * mock の戦略:
 *   1. 「気分」系の返答 → 共感 + 「軽めに行く?」を提案
 *   2. 「ふつう / いい感じ」系 → 普通に勉強の話へ
 *   3. 何でも → 1〜2 ターン雑談 → 教科選択カード
 */
type TutorState =
  | "opening" // 最初の挨拶後、本人の気分待ち
  | "after-mood" // 気分への共感を返した後、教科を聞く
  | "subject-picked" // 教科が選ばれた、教材を聞く
  | "material-picked" // 教材が選ばれた、範囲提示
  | "ready-to-start" // 体系図見せた、開始ボタン出した
  | "started"; // 学習に遷移した

export type TutorStep = {
  state: TutorState;
  /** 学習開始時に渡す情報。AI 提案ベース。 */
  proposedSubjectId?: string;
  proposedMaterialId?: string;
  proposedEntryNodeId?: string;
};

export function buildNextTutorReply(args: {
  state: TutorStep;
  userInput: string;
}): { reply: TutorMessage; nextState: TutorStep } {
  const { state, userInput } = args;
  const lower = userInput.toLowerCase().trim();
  const now = new Date().toISOString();

  // --- opening: 本人の気分にリアクション ---
  if (state.state === "opening") {
    const tired =
      lower.includes("疲れ") ||
      lower.includes("イヤ") ||
      lower.includes("やだ") ||
      lower.includes("だるい") ||
      lower.includes("つらい") ||
      lower.includes("喧嘩") ||
      lower.includes("もめ");

    if (tired) {
      return {
        nextState: { ...state, state: "after-mood" },
        reply: {
          id: makeId(),
          role: "tutor",
          text: "そっか、それはキツいね。\n\nモヤモヤしてる時って、頭の中が散らかってる感じになるじゃん？意外と勉強って整頓になることもあるんだけど、無理しすぎないでね。\n\n今日は軽めにする？それともいつもどおりやる？",
          quickReplies: ["軽めにしたい", "いつもどおり"],
          createdAt: now,
        },
      };
    }

    // ふつう / いい感じ系
    return {
      nextState: { ...state, state: "after-mood" },
      reply: {
        id: makeId(),
        role: "tutor",
        text: "ナイス、いい感じだね。\nじゃあサクッと始めよっか。何から行く？",
        card: {
          kind: "subject-picker",
          options: [
            { subjectId: "subj-english", label: "英語" },
            // 将来増えたらここに追加。MVP は英語のみ。
          ],
        },
        createdAt: now,
      },
    };
  }

  // --- after-mood: 「軽め / いつもどおり」を受けて教科ピッカー ---
  if (state.state === "after-mood") {
    const light =
      lower.includes("軽") || lower.includes("みじか") || lower.includes("短");
    return {
      nextState: { ...state, state: "after-mood" },
      reply: {
        id: makeId(),
        role: "tutor",
        text: light
          ? "了解！短めでいこう。\nで、何の教科にする？"
          : "OK、じゃあ普通のペースで。\n何の教科にする？",
        card: {
          kind: "subject-picker",
          options: [{ subjectId: "subj-english", label: "英語" }],
        },
        createdAt: now,
      },
    };
  }

  // --- subject-picked: 教材ピッカー ---
  if (state.state === "subject-picked") {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "英語ね！\nテキストはどれにする？",
        card: {
          kind: "material-picker",
          subjectId: state.proposedSubjectId ?? "subj-english",
          options: [
            {
              materialId: "mat-english-textbook-g8",
              label: "中2 英語 教科書",
              tag: "テキスト",
            },
            {
              materialId: "mat-english-workbook-g8",
              label: "中2 英語 問題集（不定詞特化）",
              tag: "問題集",
            },
            {
              materialId: "mat-english-sub-g8",
              label: "中2 英語 副教材",
              tag: "副教材",
            },
          ],
        },
        createdAt: now,
      },
    };
  }

  // --- material-picked: 範囲プレビュー ---
  if (state.state === "material-picked") {
    // mock: 教材によって entry を変える
    const matId = state.proposedMaterialId ?? "mat-english-textbook-g8";
    let entry = "inf-noun";
    let scope = ["inf", "inf-noun", "inf-adj", "inf-adv"];
    let label = "不定詞の 3 用法（名詞的・形容詞的・副詞的）あたり";
    if (matId === "mat-english-workbook-g8") {
      entry = "inf-noun";
      scope = [
        "inf",
        "inf-noun",
        "inf-adj",
        "inf-adv",
        "inf-adv-purpose",
        "inf-adv-result",
        "inf-adv-emotion",
      ];
      label = "問題集の不定詞セクション（p.32-35）";
    } else if (matId === "mat-english-sub-g8") {
      entry = "comparison";
      scope = ["comparison", "comparative", "superlative", "as-as"];
      label = "比較のセクション";
    }
    return {
      nextState: {
        ...state,
        state: "ready-to-start",
        proposedEntryNodeId: entry,
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: `OK、${matId.includes("textbook") ? "教科書" : matId.includes("workbook") ? "問題集" : "副教材"}ね。\n\n今日のところはこのへんを考えてる。`,
        card: {
          kind: "range-preview",
          entryNodeId: entry,
          highlightNodeIds: scope,
          // scope の親もハイライト対象に含めるため、簡易的に scope と同じものを scopeNodeIds に
          scopeNodeIds: scope,
          humanLabel: label,
        },
        createdAt: now,
      },
    };
  }

  // --- ready-to-start: 開始ボタン ---
  if (state.state === "ready-to-start") {
    const entry = state.proposedEntryNodeId ?? "inf-noun";
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "じゃあ始めようか！\nまず体系図の「思い出す訓練」を軽くやってから、本編に入るよ。",
        card: {
          kind: "start-study",
          entryNodeId: entry,
          withReconstruction: true,
          label: "今日の学習を始める",
        },
        createdAt: now,
      },
    };
  }

  // --- started or fallback ---
  return {
    nextState: state,
    reply: {
      id: makeId(),
      role: "tutor",
      text: "うん、続けて。",
      createdAt: now,
    },
  };
}

let idCounter = 100;
function makeId(): string {
  idCounter += 1;
  return `t-${idCounter}`;
}
