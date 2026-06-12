"use client";

/**
 * TutorChat - 担任「ゆい」さんとの chat 画面（ログイン後のランディング）。
 *
 * Phase 2 mock:
 *   - 初回挨拶からスタート
 *   - 本人の入力 / quick reply で状態遷移
 *   - リッチカード（教科 / 教材 / 体系図プレビュー / 開始ボタン）を埋め込む
 *   - 「学習を始める」で /learn?node=...&startDay=1 へ遷移
 *
 * Phase 3+ で Claude API に接続。tutor-mock.ts のスクリプトは
 * 実モデルの system prompt + tool calling に置き換わる。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import type {
  Issue,
  KnowledgeNode,
  ScheduleItem,
  TutorMessage,
  TutorTopic,
} from "@/lib/learn/types";
import { TUTOR_PERSONA } from "@/lib/learn/tutor-mock";
import { TutorAvatar } from "./TutorAvatar";
import { TutorMessageBubble } from "./TutorMessageBubble";
import { TutorComposer } from "./TutorComposer";

type Props = {
  initialMessages: TutorMessage[];
  /** Phase 3: state を親 (TutorWorkspace) に持たせるため、外から渡す */
  messages?: TutorMessage[];
  setMessages?: React.Dispatch<React.SetStateAction<TutorMessage[]>>;
  nodes: KnowledgeNode[];
  /** Phase 3: 新カード（issue-list / today-schedule）用のデータ */
  issues: Issue[];
  scheduleItems: ScheduleItem[];
  /** チャットの「次の返信」を生成する関数（mock スクリプト or Claude API 呼び出し）。
   *  Phase 6 smoke test 以降は async (Server Action 経由) を許容する。*/
  generateReply: (args: {
    userInput: string;
    history: TutorMessage[];
  }) => Promise<TutorMessage>;
  /** カード（教科ピッカー / 教材ピッカー）が選択された時に、
   *  会話の状態を進めるためのフック */
  onPickSubject: (subjectId: string, label: string) => TutorMessage;
  onPickMaterial: (materialId: string, label: string) => TutorMessage;
  /** C8 Phase 4: 計画立案の duration-picker 選択ハンドラ */
  onPickDuration: (
    monthsPerRotation: number,
    rotations: number,
  ) => TutorMessage;
  /** C17 Phase 5 P5-Q2: 計画立案の weak-node-picker 選択ハンドラ */
  onPickWeakNodes: (selectedNodeIds: string[]) => TutorMessage;
  /** Phase B (2026-06-11): 「今日なにやる?」儀式のピッカー選択ハンドラ。
   *  pick の DB 書込みを伴うため async (Promise<TutorMessage>) を許容する。 */
  dayPickedKeys: Set<string>;
  onPickDayAssignment: (
    materialId: string,
    label: string,
  ) => Promise<TutorMessage>;
  onPickDayBook: (materialId: string, label: string) => Promise<TutorMessage>;
  onPickDaySegment: (
    materialId: string,
    segmentId: string,
    label: string,
  ) => Promise<TutorMessage>;
  /** 「＋新しい宿題・テストを登録」(その場登録ダイアログを開く、Phase B 拡張) */
  onAddDayAssignment: () => void;
  /** Phase 3: 課題カードクリック → 右ペインに IssueChat / IssueListView を出す */
  onSelectIssue?: (issueId: string) => void;
  onSeeAllIssues?: () => void;
  onSelectIssueItem?: (issueId: string) => void;
  onSeeAllSchedule?: () => void;
  /** 2026-06-09: メニューの「ダッシュボード」ボタン → トップ (default ビュー) へ戻る */
  onOpenDashboard?: () => void;
  /** Phase 3: 親（TutorWorkspace）から強制的に入力欄を locked にする
   *  （右ペインに課題 chat が出ている時など）*/
  externallyLocked?: boolean;
  externalLockMessage?: string;
};

export function TutorChat({
  initialMessages,
  messages: externalMessages,
  setMessages: externalSetMessages,
  nodes,
  issues,
  scheduleItems,
  generateReply,
  onPickSubject,
  onPickMaterial,
  onPickDuration,
  onPickWeakNodes,
  dayPickedKeys,
  onPickDayAssignment,
  onPickDayBook,
  onPickDaySegment,
  onAddDayAssignment,
  onSelectIssue,
  onSeeAllIssues,
  onSelectIssueItem,
  onSeeAllSchedule,
  onOpenDashboard,
  externallyLocked,
  externalLockMessage,
}: Props) {
  // 外部から messages/setMessages が渡されている時はそちらを使う（TutorWorkspace 経由）。
  // 渡されていない時は内部 state（Phase 2 後方互換）。
  const [internalMessages, setInternalMessages] =
    useState<TutorMessage[]>(initialMessages);
  const messages = externalMessages ?? internalMessages;
  const setMessages = externalSetMessages ?? setInternalMessages;
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 新メッセージが入ったら一番下にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking]);

  // 最新の AI メッセージ（quickReplies / card を見るため）
  const lastTutorMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "tutor") ?? null,
    [messages],
  );

  // AI ターン中の locked 判定 + externallyLocked（右ペインに課題 chat が出ている時など）
  const locked = isThinking || !!externallyLocked;

  const appendThenReply = (userMsg: TutorMessage) => {
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    // 少しタメてから AI 返信（人間味）
    window.setTimeout(async () => {
      try {
        const reply = await generateReply({
          userInput: userMsg.text ?? "",
          history: [...messages, userMsg],
        });
        setMessages((prev) => appendReplyWithSection(prev, reply));
      } catch (err) {
        // 黙って失敗しない (2026-06-12 レビュー指摘): 通信断等で返信生成が落ちても
        // 子に「無視された」と感じさせず、再送を促す (入力済みの発話は履歴に残っている)。
        console.error("[ゆい chat] 返信生成失敗:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: `t-error-${Date.now()}`,
            role: "tutor",
            text: "ごめん、うまく返事できなかった…もう一回送ってみてくれる?",
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    }, 600);
  };

  const handleUserSend = (text: string) => {
    const msg: TutorMessage = {
      id: `u-${Date.now()}`,
      role: "learner",
      text,
      createdAt: new Date().toISOString(),
    };
    appendThenReply(msg);
  };

  const handlePickSubject = (subjectId: string, label: string) => {
    // カードの選択を「本人発話」として履歴に残す
    const userMsg: TutorMessage = {
      id: `u-${Date.now()}`,
      role: "learner",
      text: label,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    window.setTimeout(() => {
      const reply = onPickSubject(subjectId, label);
      setMessages((prev) => appendReplyWithSection(prev, reply));
      setIsThinking(false);
    }, 600);
  };

  const handlePickMaterial = (materialId: string, label: string) => {
    const userMsg: TutorMessage = {
      id: `u-${Date.now()}`,
      role: "learner",
      text: label,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    window.setTimeout(() => {
      const reply = onPickMaterial(materialId, label);
      setMessages((prev) => appendReplyWithSection(prev, reply));
      setIsThinking(false);
    }, 600);
  };

  // C8: 計画立案 duration-picker のハンドラ
  const handlePickDuration = (
    monthsPerRotation: number,
    rotations: number,
  ) => {
    const label = `${monthsPerRotation} ヶ月 × ${rotations} 回転`;
    const userMsg: TutorMessage = {
      id: `u-${Date.now()}`,
      role: "learner",
      text: label,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    window.setTimeout(() => {
      const reply = onPickDuration(monthsPerRotation, rotations);
      setMessages((prev) => appendReplyWithSection(prev, reply));
      setIsThinking(false);
    }, 600);
  };

  // Phase B (2026-06-11): 「今日なにやる?」儀式のピッカー。選択を本人発話として
  // 履歴に残し、async ハンドラ (pick の DB 書込みあり) の返信を append する共通形。
  const handleDayPick = (
    label: string,
    run: () => Promise<TutorMessage>,
  ) => {
    const userMsg: TutorMessage = {
      // eslint-disable-next-line react-hooks/purity -- 既存ハンドラ (handlePickSubject 等) と同じ Date.now() id 採番。イベントハンドラ内でしか呼ばれない
      id: `u-${Date.now()}`,
      role: "learner",
      text: label,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    window.setTimeout(async () => {
      try {
        const reply = await run();
        setMessages((prev) => appendReplyWithSection(prev, reply));
      } catch (err) {
        // 黙って失敗しない (2026-06-12 レビュー指摘、appendThenReply と同パターン)。
        console.error("[ゆい chat] 儀式ピッカー処理失敗:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: `t-error-${Date.now()}`,
            role: "tutor",
            text: "ごめん、うまくできなかった…もう一回選んでみてくれる?",
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    }, 600);
  };

  // C17 Phase 5 P5-Q2: weak-node-picker ハンドラ
  const handlePickWeakNodes = (selectedNodeIds: string[]) => {
    const label =
      selectedNodeIds.length > 0
        ? `重点練習に ${selectedNodeIds.length} 件 登録`
        : "重点練習なしで進める";
    const userMsg: TutorMessage = {
      id: `u-${Date.now()}`,
      role: "learner",
      text: label,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    window.setTimeout(() => {
      const reply = onPickWeakNodes(selectedNodeIds);
      setMessages((prev) => appendReplyWithSection(prev, reply));
      setIsThinking(false);
    }, 600);
  };

  const quickReplies =
    !isThinking && lastTutorMessage?.quickReplies
      ? lastTutorMessage.quickReplies
      : undefined;

  const noop = () => {};

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ヘッダー */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <TutorAvatar size="md" />
        <div className="flex flex-1 flex-col leading-tight">
          <span className="text-sm font-semibold">
            {TUTOR_PERSONA.name}先生
          </span>
          <span className="text-[10px] text-muted-foreground">
            {TUTOR_PERSONA.subtitle}
          </span>
        </div>
      </header>

      {/* 定番メニュー（常時表示・ハブ動線、ヘッダ直下に固定）*/}
      <TutorHubMenu disabled={locked} onOpenDashboard={onOpenDashboard} />

      {/* メッセージリスト */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-5">
          {messages.map((m) => (
            <TutorMessageBubble
              key={m.id}
              message={m}
              nodes={nodes}
              onPickSubject={handlePickSubject}
              onPickMaterial={handlePickMaterial}
              onPickDuration={handlePickDuration}
              onPickWeakNodes={handlePickWeakNodes}
              dayPickedKeys={dayPickedKeys}
              onPickDayAssignment={(materialId, label) =>
                handleDayPick(label, () =>
                  onPickDayAssignment(materialId, label),
                )
              }
              onPickDayBook={(materialId, label) =>
                handleDayPick(label, () => onPickDayBook(materialId, label))
              }
              onPickDaySegment={(materialId, segmentId, label) =>
                handleDayPick(label, () =>
                  onPickDaySegment(materialId, segmentId, label),
                )
              }
              onAddDayAssignment={onAddDayAssignment}
              issues={issues}
              scheduleItems={scheduleItems}
              onSelectIssue={onSelectIssue ?? noop}
              onSeeAllIssues={onSeeAllIssues ?? noop}
              onSelectIssueItem={onSelectIssueItem ?? noop}
              onSeeAllSchedule={onSeeAllSchedule ?? noop}
            />
          ))}

          {isThinking && (
            <div className="flex items-center gap-2.5">
              <TutorAvatar size="md" />
              <div className="rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5">
                <div className="flex gap-1">
                  <Dot delay={0} />
                  <Dot delay={150} />
                  <Dot delay={300} />
                </div>
              </div>
            </div>
          )}

          {/* scroll sentinel */}
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      </div>

      {/* 入力欄 */}
      <div className="mx-auto w-full max-w-3xl">
        {externallyLocked && externalLockMessage && (
          <div className="border-t border-border bg-muted/30 px-3 py-2 text-center text-[11px] text-muted-foreground">
            {externalLockMessage}
          </div>
        )}
        <TutorComposer
          quickReplies={quickReplies}
          onSend={handleUserSend}
          locked={locked}
        />
      </div>
    </div>
  );
}

/**
 * TutorHubMenu - 入力欄下の定番メニュー（Phase 3）。
 * scripted な quickReplies とは別枠で、いつでもハブ動線にアクセスできる。
 * 通常ボタンは該当キーワードを発話扱いで送信 → tutor-mock の分岐で
 * 右ペイン展開 or 学習開始フローに入る。
 *
 * Phase 3 拡張（2026-05-24）:
 *   サイドバーから科目の先生エントリを撤去し、ここに「先生との対話」
 *   プルダウンを追加。科目の先生（あおい先生 等）との対話履歴を
 *   subjects から動的に列挙する。
 */
function TutorHubMenu({
  disabled,
  onOpenDashboard,
}: {
  disabled?: boolean;
  /** 「ダッシュボード」ボタン → トップ (default ビュー) へ。NL を介さず直接遷移 */
  onOpenDashboard?: () => void;
}) {
  // 2026-06-09 ito19 さん意見: メニューを大幅削減し、日常の動線は全部ダッシュボードに集約。
  //   旧メニュー (今日のタスク / 課題 / 先生▼ / もっと▼ / 教材 / レジュメ / プラン) は撤去。
  //   - 課題 / 教材 / レジュメ / プラン → ダッシュボードのカード・セクションから入る
  //   - 対話履歴 / 学習履歴 / 振り返りログ → ダッシュボード下部「これまでの記録」へ
  //   - レポート (今週/今月) / 帰宅儀式 → 廃止
  //   メニューは「ダッシュボード (=ホーム)」1 つだけに絞る。
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-muted/20 px-3 py-2">
      <span className="mr-1 text-[10px] font-medium text-muted-foreground">
        メニュー
      </span>

      {onOpenDashboard && (
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenDashboard}
          className="flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
        >
          <LayoutDashboard className="size-3" />
          <span>ダッシュボード</span>
        </button>
      )}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

/**
 * AI 返信を thread に追加する時、直前の tutor message と話題が変わってたら
 * 自動でセクションヘッダー (role: "section") を間に挿入する（Phase 3 拡張）。
 * 同じ話題内なら何もせず append のみ。
 */
function appendReplyWithSection(
  prev: TutorMessage[],
  reply: TutorMessage,
): TutorMessage[] {
  if (reply.role !== "tutor" || !reply.topic) {
    return [...prev, reply];
  }
  // 直前の tutor message の topic を探す
  let lastTutorTopic: TutorTopic | undefined;
  for (let i = prev.length - 1; i >= 0; i--) {
    if (prev[i].role === "tutor") {
      lastTutorTopic = prev[i].topic;
      break;
    }
  }
  if (lastTutorTopic === reply.topic) {
    // 同じ話題 → ヘッダー不要
    return [...prev, reply];
  }
  // 話題切り替わり → セクションヘッダーを挟む
  const sectionHeader: TutorMessage = {
    id: `sec-${Date.now()}`,
    role: "section",
    topic: reply.topic,
    createdAt: reply.createdAt,
  };
  return [...prev, sectionHeader, reply];
}
