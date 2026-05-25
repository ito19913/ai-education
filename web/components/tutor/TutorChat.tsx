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
import { ChevronDown, GraduationCap } from "lucide-react";
import type {
  Issue,
  KnowledgeNode,
  ScheduleItem,
  Subject,
  TutorMessage,
  TutorTopic,
} from "@/lib/learn/types";
import { TUTOR_PERSONA } from "@/lib/learn/tutor-mock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  /** Phase 3 拡張: TutorHubMenu の「先生との対話」プルダウン用 */
  subjects: Subject[];
  /** チャットの「次の返信」を生成する純関数（mock スクリプト or API 呼び出し）*/
  generateReply: (args: {
    userInput: string;
    history: TutorMessage[];
  }) => TutorMessage;
  /** カード（教科ピッカー / 教材ピッカー）が選択された時に、
   *  会話の状態を進めるためのフック */
  onPickSubject: (subjectId: string, label: string) => TutorMessage;
  onPickMaterial: (materialId: string, label: string) => TutorMessage;
  /** C8 Phase 4: 計画立案の duration-picker 選択ハンドラ */
  onPickDuration: (
    monthsPerRotation: number,
    rotations: number,
  ) => TutorMessage;
  /** Phase 3: 課題カードクリック → 右ペインに IssueChat / IssueListView を出す */
  onSelectIssue?: (issueId: string) => void;
  onSeeAllIssues?: () => void;
  onSelectIssueItem?: (issueId: string) => void;
  onSeeAllSchedule?: () => void;
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
  subjects,
  generateReply,
  onPickSubject,
  onPickMaterial,
  onPickDuration,
  onSelectIssue,
  onSeeAllIssues,
  onSelectIssueItem,
  onSeeAllSchedule,
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
    window.setTimeout(() => {
      const reply = generateReply({
        userInput: userMsg.text ?? "",
        history: [...messages, userMsg],
      });
      setMessages((prev) => appendReplyWithSection(prev, reply));
      setIsThinking(false);
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
      <TutorHubMenu
        onSend={handleUserSend}
        subjects={subjects}
        disabled={locked}
      />

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
  onSend,
  subjects,
  disabled,
}: {
  onSend: (text: string) => void;
  subjects: Subject[];
  disabled?: boolean;
}) {
  // C13: メニュー整理 (2026-05-25)
  // ito19 さん指示:
  //   - 一番左に「今日のタスク」(毎日ここから、帰宅儀式の起動点も統合)
  //   - 次に「課題」(残課題 + クリア履歴で達成感)
  //   - 「先生 ▼」プルダウン (既存)
  //   - 「もっと ▼」プルダウン (履歴 / レポート / アーカイブ / 帰宅 緊急)
  //   - 一番右に「プラン」(毎日やるもんじゃないから右端、PDCA の P 入口)
  //
  // 撤去:
  //   - 「学習を開始」: 「今日のタスク」から start するため不要
  //   - 「スケジュール確認」: 「今日のタスク」にリネーム統合
  //   - 「教材を追加」: 計画 (プラン) に紐づくので「プラン」内に統合
  //   - 「振り返り」「履歴」: 「もっと ▼」内に格納
  //   - 「帰ってきた」: 平日 16:00 自動起動 (C10) が主、明示は「もっと」内に
  const primaryItems: Array<{
    label: string;
    phrase: string;
    emphasis?: boolean;
  }> = [
    { label: "今日のタスク", phrase: "今日のタスク", emphasis: true },
    { label: "課題", phrase: "課題を確認" },
  ];

  // teacher が設定されてる科目だけプルダウンに出す
  const teachersAvailable = subjects.filter((s) => s.teacher);

  // 「もっと ▼」プルダウン (履歴・アーカイブ・緊急動線)
  const archiveItems: Array<{ label: string; phrase: string }> = [
    { label: "振り返りログ", phrase: "振り返りログ" },
    { label: "今週のレポート", phrase: "今週のレポート" },
    { label: "今月のレポート", phrase: "今月のレポート" },
    { label: "学習履歴", phrase: "学習履歴" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-muted/20 px-3 py-2">
      <span className="mr-1 text-[10px] font-medium text-muted-foreground">
        メニュー
      </span>

      {/* 主動線 (左): 今日のタスク / 課題 */}
      {primaryItems.map((it) => (
        <button
          key={it.phrase}
          type="button"
          disabled={disabled}
          onClick={() => onSend(it.phrase)}
          className={
            it.emphasis
              ? "rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
              : "rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
          }
        >
          {it.label}
        </button>
      ))}

      {/* 「先生 ▼」プルダウン: 担任ゆい先生 + 科目の先生 (既存維持) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={disabled}
              className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
            />
          }
        >
          <span>先生</span>
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[220px]">
          <div className="border-b border-border px-1.5 py-1 text-[10px] font-medium text-muted-foreground">
            担任の先生
          </div>
          <div className="py-1">
            <DropdownMenuItem onClick={() => onSend("ゆい対話履歴")}>
              <GraduationCap />
              <span className="font-medium">ゆい先生</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                私との対話
              </span>
            </DropdownMenuItem>
          </div>
          {teachersAvailable.length > 0 && (
            <>
              <div className="border-b border-t border-border px-1.5 py-1 text-[10px] font-medium text-muted-foreground">
                科目の先生
              </div>
              <div className="py-1">
                {teachersAvailable.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => onSend(s.teacher!.displayName)}
                  >
                    <GraduationCap />
                    <span className="font-medium">
                      {s.teacher!.displayName}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {s.name}
                    </span>
                  </DropdownMenuItem>
                ))}
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 「もっと ▼」プルダウン: 履歴・アーカイブ・緊急動線 (C13 新規) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={disabled}
              className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
            />
          }
        >
          <span>もっと</span>
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          <div className="border-b border-border px-1.5 py-1 text-[10px] font-medium text-muted-foreground">
            アーカイブ
          </div>
          <div className="py-1">
            {archiveItems.map((it) => (
              <DropdownMenuItem
                key={it.phrase}
                onClick={() => onSend(it.phrase)}
              >
                <span>{it.label}</span>
              </DropdownMenuItem>
            ))}
          </div>
          <div className="border-b border-t border-border px-1.5 py-1 text-[10px] font-medium text-muted-foreground">
            緊急動線
          </div>
          <div className="py-1">
            <DropdownMenuItem onClick={() => onSend("帰ってきた")}>
              <span>帰ってきた (帰宅儀式)</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* スペーサー: 「プラン」を右端に押し出す */}
      <div className="flex-1" />

      {/* 「プラン」ボタン (右端): 計画立案フロー C8 起動 */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSend("計画立てよう")}
        className="rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
        title="PDCA の P (計画立案)。毎日じゃない、節目で立てる。"
      >
        プラン
      </button>
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
