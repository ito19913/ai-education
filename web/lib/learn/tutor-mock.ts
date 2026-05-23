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
import { MOCK_ISSUES, MOCK_SCHEDULE_TODAY } from "./mock-data";

/**
 * 担任の persona（Claude API 接続時の system prompt の元になる）。
 *
 * 設計原則は ARCHITECTURE.md の「ゆい先生 = コーチング エージェント」セクション参照。
 * 教えない（教科の中身は絶対 NG、葵先生に振る）、引き出す。
 * 発話の大半は質問。未来志向。承認は観察ベース。GROW を意識的に回す。
 * 武田塾「説明させる」+ ファインマン式を技法として使う（教えるんじゃなく、引き出す）。
 */
export const TUTOR_PERSONA = {
  name: "ゆい",
  description:
    "20代前半の女性チューター。東進ハイスクールのチューター + 武田塾のコーチング講師を融合したスタイル。教えるのは科目の先生（葵先生）に完全に任せ、自分は『教えない、引き出す』を徹底する純粋コーチ。GROW モデル（Goal/Reality/Options/Will）を意識して質問中心に対話し、過去原因の追及より「次どうする?」の未来志向。承認は評価でなく観察ベース。生徒の生活・気分・スケジュール・モチベ・振り返り・掘り起こし・科目の先生への申し送り を横断的に扱う。「〜だよ」「〜してみる?」「了解!」「そっか」みたいな砕けた口調。距離が近め、感情の話もしやすい。Phase 3 拡張で振り返り（日次/週次/月次）と掘り起こし（『何が分からないか分からない』を質問で言語化させる技法）を中核業務に追加。",
  avatarLetter: "ゆ",
  /** ヘッダー等で使うサブタイトル */
  subtitle: "担任の先生（コーチ）",
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
      text: `${greeting} 今日はどんな一日だった？\n\n勉強の話でも、学校でのことでも、なんでも聞くよ。一言からでも OK。\n\nすぐ取り掛かりたい時は、上のメニューから「学習を開始」「課題を確認」「スケジュール確認」「教材を追加」「履歴を確認」を選んでもいいよ。`,
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

  // --- ハブ動作（Phase 3）: state に関係なく、課題 / スケジュール / 履歴の呼び出しに反応 ---
  // 「課題見せて」「やる事は?」「未クリア」
  if (
    lower.includes("課題") ||
    lower.includes("やる事") ||
    lower.includes("やること") ||
    lower.includes("未クリア")
  ) {
    const openIssues = MOCK_ISSUES.filter((i) => i.status === "open");
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text:
          openIssues.length > 0
            ? `未クリアの課題、いま ${openIssues.length} 件あるね。\nどれからいく? 全部見るならカードの下のボタンから。`
            : "未クリアの課題はないよ。気持ちいい!",
        card: {
          kind: "issue-list",
          issueIds: openIssues.slice(0, 5).map((i) => i.id),
          seeAllLabel: "課題一覧を全部見る",
        },
        rightPaneAction: { kind: "open-issues" },
        createdAt: now,
      },
    };
  }

  // 「スケジュール」「予定」「今日のタスク」
  if (
    lower.includes("スケジュール") ||
    lower.includes("予定") ||
    (lower.includes("今日") && lower.includes("タスク"))
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text:
          MOCK_SCHEDULE_TODAY.length > 0
            ? `今日のタスクはこんな感じ。気になるやつから手をつけよっか。`
            : "今日のタスクはまだ立ててないね。AI と一緒に組み立てる?",
        card: {
          kind: "today-schedule",
          scheduleItemIds: MOCK_SCHEDULE_TODAY.slice(0, 5).map((i) => i.id),
          seeAllLabel: "スケジュールを全部見る",
        },
        rightPaneAction: { kind: "open-schedule" },
        createdAt: now,
      },
    };
  }

  // 「教材を追加」「教材追加」「教材登録」「PDF」「テキスト追加」
  if (
    lower.includes("教材") ||
    lower.includes("pdf") ||
    lower.includes("テキスト追加") ||
    lower.includes("テキスト登録")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、新規教材登録するね。右でやろう。\nPDF を選んで、AI が体系図ノードを抽出するから、それを一緒に監修していこう。",
        rightPaneAction: { kind: "open-material-new" },
        createdAt: now,
      },
    };
  }

  // 「学習を開始」「学習を始める」「勉強する」「始める」
  if (
    lower.includes("学習を開始") ||
    lower.includes("学習を始める") ||
    lower.includes("勉強する") ||
    lower === "始める" ||
    lower === "始めたい"
  ) {
    return {
      nextState: { ...state, state: "after-mood" },
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、始めよっか！\n何の教科にする?",
        card: {
          kind: "subject-picker",
          options: [{ subjectId: "subj-english", label: "英語" }],
        },
        createdAt: now,
      },
    };
  }

  // 「あおい先生」「英語の先生」「英語 履歴」「英語の対話」「英語 何話した」
  // ※「履歴」分岐より先に判定する必要がある（先勝ちで一般「履歴」に持っていかれないように）
  if (
    lower.includes("あおい先生") ||
    lower.includes("あおい") ||
    lower.includes("英語の先生") ||
    lower.includes("英語 履歴") ||
    lower.includes("英語履歴") ||
    lower.includes("英語の対話") ||
    lower.includes("英語の履歴") ||
    (lower.includes("英語") && lower.includes("何話した"))
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "あおい先生（英語）との対話履歴、右に出すね。\nノード対話と課題 chat を時系列で全部見られるよ。",
        rightPaneAction: {
          kind: "open-subject-history",
          subjectId: "subj-english",
        },
        createdAt: now,
      },
    };
  }

  // 「履歴」「振り返り」「これまで」
  if (
    lower.includes("履歴") ||
    lower.includes("振り返") ||
    lower.includes("これまで")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "これまでの学習履歴、右に出すね。\nセッションごとの時間とまとめが見られるよ。",
        rightPaneAction: { kind: "open-history" },
        createdAt: now,
      },
    };
  }

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
