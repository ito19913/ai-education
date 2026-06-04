"use client";

/**
 * IssueChat - 課題 1 件に対する科目の先生との chat 本体（Phase 3）。
 *
 * 構造:
 *   - ヘッダ: Issue タイトル + 「分かった！」「もどる」ボタン
 *   - 中央: メッセージリスト（IssueChatBubble）
 *   - 下部: IssueChatComposer（resolved 時は readonly）
 *
 * chatThread が空の Issue を開いた時は、buildInitialIssueChat で初手 AI 発話を生成。
 * 「クリアして」発話 or 「分かった！」ボタンで resolved に遷移。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, CircleDot, Target } from "lucide-react";
import type {
  ChatMessage,
  Issue,
  IssueChatMessage,
  KnowledgeNode,
} from "@/lib/learn/types";
import { IssueChatBubble } from "./IssueChatBubble";
import { IssueChatComposer } from "./IssueChatComposer";
import { HandoffBanner } from "./HandoffBanner";
import { MOCK_HANDOFFS } from "@/lib/learn/mock-data";
import {
  buildInitialIssueChat,
  buildNextIssueChatReply,
  buildNextIssueChatReplyAsync,
  type IssueChatStep,
} from "@/lib/learn/issue-chat-mock";

type Props = {
  issue: Issue;
  /** 関連ノード（タイトル表示用）*/
  nodes: KnowledgeNode[];
  /** AI 発の Issue で trigger-message-quote 引用に使う候補 ChatMessage 群（mock 段階） */
  chatMessages: ChatMessage[];
  /** Issue 状態を resolve / reopen するコールバック（親 state に伝播）*/
  onResolve: () => void;
  onReopen: () => void;
  /** chatThread に新メッセージが追加された時、親 state に伝播する */
  onAppendMessages: (msgs: IssueChatMessage[]) => void;
  /** 「もどる」クリック（右ペインを閉じる）*/
  onBack: () => void;
};

export function IssueChat({
  issue,
  nodes,
  chatMessages,
  onResolve,
  onReopen,
  onAppendMessages,
  onBack,
}: Props) {
  const resolved = issue.status === "resolved";
  const [isThinking, setIsThinking] = useState(false);
  const stepRef = useRef<IssueChatStep>({
    issueId: issue.id,
    turnCount: issue.chatThread?.length ?? 0,
  });
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // chatThread が空の Issue を開いた時、初手 AI 発話を 1 回だけ生成
  const initialDoneRef = useRef(false);
  useEffect(() => {
    if (initialDoneRef.current) return;
    if (issue.chatThread && issue.chatThread.length > 0) {
      initialDoneRef.current = true;
      return;
    }
    initialDoneRef.current = true;
    const triggerId =
      issue.triggerMessageId ?? issue.occurrences?.[0]?.triggerMessageId;
    const triggerMessage = triggerId
      ? chatMessages.find((m) => m.id === triggerId)
      : undefined;
    const initial = buildInitialIssueChat({ issue, triggerMessage });
    if (initial.length > 0) {
      onAppendMessages(initial);
      stepRef.current = {
        ...stepRef.current,
        turnCount: stepRef.current.turnCount + initial.length,
      };
    }
  }, [issue, chatMessages, onAppendMessages]);

  const thread = issue.chatThread ?? [];

  const nodeName = useMemo(
    () => nodes.find((n) => n.id === issue.nodeId)?.name ?? issue.nodeId,
    [nodes, issue.nodeId],
  );

  // C5: 当該 Issue に紐づくゆいからの申し送り
  // relatedIssueId == issue.id で絞り込み。日時昇順で並べる（古い順 = 出来事順）。
  // MOCK_HANDOFFS への ranetime push (C3) も即反映される。
  const issueHandoffs = useMemo(
    () =>
      MOCK_HANDOFFS.filter((h) => h.relatedIssueId === issue.id).sort(
        (a, b) => (a.createdAt < b.createdAt ? -1 : 1),
      ),
    [issue.id],
  );

  // 引用元 node 名（trigger-message-quote 表示用）
  const sourceNodeName = useMemo(() => {
    const triggerId =
      issue.triggerMessageId ?? issue.occurrences?.[0]?.triggerMessageId;
    if (!triggerId) return undefined;
    const msg = chatMessages.find((m) => m.id === triggerId);
    if (!msg) return undefined;
    return nodes.find((n) => n.id === msg.nodeId)?.name;
  }, [issue, chatMessages, nodes]);

  // 末尾までスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.length, isThinking]);

  // 最後の teacher メッセージから quickReplies を引く
  const lastTeacherMessage = [...thread]
    .reverse()
    .find((m) => m.role === "teacher");
  const quickReplies =
    !isThinking && !resolved ? lastTeacherMessage?.quickReplies : undefined;

  const handleSend = (text: string) => {
    if (resolved) return;
    const now = new Date().toISOString();
    const learnerMsg: IssueChatMessage = {
      id: `ic-${Date.now()}-l`,
      issueId: issue.id,
      role: "learner",
      text,
      createdAt: now,
    };
    onAppendMessages([learnerMsg]);
    setIsThinking(true);
    // 思考演出（600ms）→ async 応答生成 (B2 C76: NEXT_PUBLIC_USE_CLAUDE_API=true
    // なら Claude 経由、それ以外は mock fallback)
    setTimeout(() => {
      void (async () => {
        try {
          const result = await buildNextIssueChatReplyAsync({
            state: stepRef.current,
            issue,
            userInput: text,
            // 教科名・先生名は subjects から取得 (本実装では subjects prop が必要)、
            // 現状は IssueChat に渡ってきてないので default の "教科" / persona.displayName
            // を Server Action 側で使う
          });
          stepRef.current = result.nextState;
          onAppendMessages([result.reply]);
          if (result.shouldResolve) {
            // AI が「クリアしておくね」と言った直後に resolve
            onResolve();
          }
        } catch (err) {
          console.error("[B2] issue-chat async failed, fallback sync:", err);
          const result = buildNextIssueChatReply({
            state: stepRef.current,
            issue,
            userInput: text,
          });
          stepRef.current = result.nextState;
          onAppendMessages([result.reply]);
          if (result.shouldResolve) onResolve();
        } finally {
          setIsThinking(false);
        }
      })();
    }, 600);
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      {/* ヘッダ: Issue タイトル + 操作ボタン */}
      <header className="flex items-start gap-3 border-b border-border bg-background px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={onBack}
          aria-label="もどる"
        >
          <ArrowLeft className="size-3.5" />
          <span>もどる</span>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Target className="size-3.5 shrink-0 text-primary" />
            <p className="truncate text-sm font-semibold text-foreground">
              {issue.title}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {nodeName} ·{" "}
            {issue.source === "self" ? "本人が立てた課題" : "AI が拾った課題"}
            {resolved && <span className="ml-1 text-emerald-600">· クリア済み</span>}
          </p>
        </div>
        {resolved ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onReopen}
          >
            <CircleDot className="size-3.5" />
            <span>未クリアに戻す</span>
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5" onClick={onResolve}>
            <Check className="size-3.5" />
            <span>分かった！</span>
          </Button>
        )}
      </header>

      {/* C5: ゆいからの申し送りバナー（handoff があれば表示） */}
      <HandoffBanner handoffs={issueHandoffs} />

      {/* 中央: メッセージリスト */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
          {thread.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
              あおい先生を呼んでいます…
            </div>
          )}
          {thread.map((m) => (
            <IssueChatBubble
              key={m.id}
              message={m}
              sourceNodeName={sourceNodeName}
              onResolveClick={onResolve}
              resolved={resolved}
            />
          ))}
          {isThinking && (
            <div className="flex items-start gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                あ
              </div>
              <div className="rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
                <span className="animate-pulse">考え中…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 下部: Composer */}
      <div className="mx-auto w-full max-w-3xl">
        <IssueChatComposer
          quickReplies={quickReplies}
          onSend={handleSend}
          locked={isThinking}
          readonly={resolved}
        />
      </div>
    </div>
  );
}
