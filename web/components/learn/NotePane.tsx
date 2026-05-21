"use client";

/**
 * NotePane - Pane 4。AI が自動生成するノート（マークダウンプレビュー）+ メモ。
 *
 * - ノートは react-markdown でレンダリング（生マークダウンではなくプレビュー表示）
 * - 編集は MVP では行わない（AI が会話の流れから更新する想定）
 * - メモ（分からなかった所）は別カード。チェックで「解決」にできる。
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronRight,
  Notebook,
  Quote,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { KnowledgeNode, Memo, Note } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  currentNode: KnowledgeNode | null;
  note: Note | null;
  memos: Memo[];
  onChangeNote: (content: string) => void; // 将来 AI が更新する用
  onToggleMemoResolved: (id: string) => void;
};

const mdComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mt-4 mb-3 flex items-center gap-2 border-b border-border pb-2 text-lg font-semibold text-foreground first:mt-0">
      <BookOpen className="size-5 text-primary" />
      <span>{children}</span>
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-4 mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
      <Sparkles className="size-4 text-primary" />
      <span>{children}</span>
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-3 mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
      <ChevronRight className="size-3.5 text-primary" />
      <span>{children}</span>
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-2 text-sm leading-relaxed text-card-foreground">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-2 flex flex-col gap-1 text-sm text-card-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-2 ml-1 flex list-decimal flex-col gap-1 pl-5 text-sm text-card-foreground marker:font-medium marker:text-primary">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    // ul の中の li にはチェックアイコン。ol の中ではアイコン非表示（CSS で）。
    <li className="flex items-start gap-2 leading-relaxed [ol_&]:list-decimal [ol_&]:gap-0">
      <Check className="mt-0.5 size-3.5 shrink-0 text-primary [ol_&]:hidden" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="rounded bg-primary/15 px-1 py-0.5 font-semibold text-foreground">
      {children}
    </strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-foreground">{children}</em>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-3 flex gap-2 rounded-md border-l-4 border-primary bg-primary/5 p-3 text-sm italic text-muted-foreground">
      <Quote className="size-4 shrink-0 text-primary/60" />
      <div className="flex-1">{children}</div>
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  a: ({
    children,
    href,
  }: {
    children?: React.ReactNode;
    href?: string;
  }) => (
    <a href={href} className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
};

export function NotePane({
  currentNode,
  note,
  memos,
  onToggleMemoResolved,
}: Props) {
  return (
    <div className="flex h-full w-full flex-col border-l border-border bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <Notebook className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">ノート</h2>
        {currentNode && (
          <span className="ml-auto truncate text-xs text-muted-foreground">
            {currentNode.name}
          </span>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {!note ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                このノードのノートはまだありません。
                <br />
                AI と会話を始めると、自動的にノートが育っていきます。
              </p>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">学習ノート</CardTitle>
              </CardHeader>
              <CardContent>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={mdComponents}
                >
                  {note.content}
                </ReactMarkdown>
              </CardContent>
            </Card>
          )}

          {memos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertCircle className="size-4 text-muted-foreground" />
                  メモ（分からなかった所）
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {memos.map((memo) => (
                  <div
                    key={memo.id}
                    className="flex items-start gap-2 rounded-md border border-border bg-card p-3"
                  >
                    <Button
                      size="icon"
                      variant={memo.resolved ? "default" : "outline"}
                      className="mt-0.5 size-6 shrink-0"
                      onClick={() => onToggleMemoResolved(memo.id)}
                      aria-label={
                        memo.resolved ? "解決済みを取り消す" : "解決にする"
                      }
                    >
                      {memo.resolved && <Check className="size-3" />}
                    </Button>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
                        memo.resolved && "text-muted-foreground line-through",
                      )}
                    >
                      {memo.content}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
