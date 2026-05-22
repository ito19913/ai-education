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
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarClock, GraduationCap, Info } from "lucide-react";
import type { KnowledgeNode, TutorMessage } from "@/lib/learn/types";
import { TUTOR_PERSONA } from "@/lib/learn/tutor-mock";
import { TutorAvatar } from "./TutorAvatar";
import { TutorMessageBubble } from "./TutorMessageBubble";
import { TutorComposer } from "./TutorComposer";

type Props = {
  initialMessages: TutorMessage[];
  nodes: KnowledgeNode[];
  /** チャットの「次の返信」を生成する純関数（mock スクリプト or API 呼び出し）*/
  generateReply: (args: {
    userInput: string;
    history: TutorMessage[];
  }) => TutorMessage;
  /** カード（教科ピッカー / 教材ピッカー）が選択された時に、
   *  会話の状態を進めるためのフック */
  onPickSubject: (subjectId: string, label: string) => TutorMessage;
  onPickMaterial: (materialId: string, label: string) => TutorMessage;
};

export function TutorChat({
  initialMessages,
  nodes,
  generateReply,
  onPickSubject,
  onPickMaterial,
}: Props) {
  const [messages, setMessages] = useState<TutorMessage[]>(initialMessages);
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

  // AI ターン中の locked 判定
  // ルール: 最新メッセージが AI で card がある → 本人はカードで選ぶか自由テキスト
  // 最新メッセージが AI で text のみ + quickReplies → 本人入力待ち
  // 最新が learner → AI 応答待ち（isThinking）
  const locked = isThinking;

  const appendThenReply = (userMsg: TutorMessage) => {
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    // 少しタメてから AI 返信（人間味）
    window.setTimeout(() => {
      const reply = generateReply({
        userInput: userMsg.text ?? "",
        history: [...messages, userMsg],
      });
      setMessages((prev) => [...prev, reply]);
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
      setMessages((prev) => [...prev, reply]);
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
      setMessages((prev) => [...prev, reply]);
      setIsThinking(false);
    }, 600);
  };

  const quickReplies =
    !isThinking && lastTutorMessage?.quickReplies
      ? lastTutorMessage.quickReplies
      : undefined;

  return (
    <div className="flex h-screen flex-col bg-background">
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
        <Link href="/schedule">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <CalendarClock className="size-4" />
            <span>スケジュールを見る</span>
          </Button>
        </Link>
      </header>

      {/* メッセージリスト */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-5">
          {/* 説明バナー (Phase 2 mock であることを伝える) */}
          <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              これは Phase 2 mock の担任 chat です。応答は scripted。Phase 3 で Claude
              API に接続して、学習履歴・課題・スケジュールを踏まえた本物の対話になります。
            </span>
          </div>

          {messages.map((m) => (
            <TutorMessageBubble
              key={m.id}
              message={m}
              nodes={nodes}
              onPickSubject={handlePickSubject}
              onPickMaterial={handlePickMaterial}
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
        <TutorComposer
          quickReplies={quickReplies}
          onSend={handleUserSend}
          locked={locked}
        />
        <div className="flex items-center justify-center gap-3 pb-3 pt-1 text-[10px] text-muted-foreground">
          <Link
            href="/schedule"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            スケジュールへ
          </Link>
          <span>・</span>
          <Link
            href="/issues"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            課題一覧
          </Link>
          <span>・</span>
          <Link
            href="/learn"
            className="inline-flex items-center gap-0.5 underline-offset-2 hover:text-foreground hover:underline"
          >
            <GraduationCap className="size-3" />
            学習画面（直接）
          </Link>
        </div>
      </div>
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
