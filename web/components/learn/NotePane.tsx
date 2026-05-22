"use client";

/**
 * NotePane - Pane 4。AI が自動生成するノート（マークダウンプレビュー）+ 課題（本人発）。
 *
 * - ノートは react-markdown でレンダリング（プレビュー表示）
 * - 編集は MVP では行わない（AI が会話の流れから更新する想定）
 * - 「課題」セクション: 本人が「これ分からない」と立てる場所。
 *   旧 メモ機能と統合。立てた瞬間に /issues の一覧にも入る。
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Notebook,
  Plus,
  Quote,
  Sparkles,
  Target,
  User as UserIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Issue, KnowledgeNode, Note } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  currentNode: KnowledgeNode | null;
  note: Note | null;
  /** このノードに紐づく課題 */
  issues: Issue[];
  onChangeNote: (content: string) => void; // 将来 AI が更新する用
  /** 本人発の課題を追加 */
  onAddIssue: (title: string) => void;
  /** 課題をクリア */
  onResolveIssue: (id: string) => void;
  /** クリア取り消し */
  onReopenIssue: (id: string) => void;
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
  issues,
  onAddIssue,
  onResolveIssue,
  onReopenIssue,
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

          <IssuesSection
            issues={issues}
            onAdd={onAddIssue}
            onResolve={onResolveIssue}
            onReopen={onReopenIssue}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * このノードに紐づく課題のセクション。
 * 本人が「これ分からない」を入力して立てる + 既存の課題（本人発・AI 発両方）を表示。
 */
function IssuesSection({
  issues,
  onAdd,
  onResolve,
  onReopen,
}: {
  issues: Issue[];
  onAdd: (title: string) => void;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);

  const openIssues = issues.filter((i) => i.status === "open");
  const resolvedIssues = issues.filter((i) => i.status === "resolved");

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
    setComposing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Target className="size-4 text-muted-foreground" />
          <span className="flex-1">課題</span>
          <Link
            href="/issues"
            className="text-[11px] font-normal text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            一覧へ
          </Link>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          「分からない」「曖昧」と思った瞬間に立てる。後で潰す。
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {openIssues.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            onResolve={() => onResolve(issue.id)}
            onReopen={() => onReopen(issue.id)}
          />
        ))}

        {composing ? (
          <div className="flex flex-col gap-2 rounded-md border border-primary/40 bg-card p-2.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="例：動名詞との使い分けが分からない"
              className="min-h-[64px] resize-none text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setComposing(false);
                  setDraft("");
                }}
              >
                やめる
              </Button>
              <Button size="sm" onClick={submit} disabled={!draft.trim()}>
                課題に追加
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
            onClick={() => setComposing(true)}
          >
            <Plus className="size-3.5" />
            <span>課題を立てる（本人発）</span>
          </Button>
        )}

        {resolvedIssues.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
              クリア済み {resolvedIssues.length} 件
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {resolvedIssues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  onResolve={() => onResolve(issue.id)}
                  onReopen={() => onReopen(issue.id)}
                />
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function IssueRow({
  issue,
  onResolve,
  onReopen,
}: {
  issue: Issue;
  onResolve: () => void;
  onReopen: () => void;
}) {
  const isResolved = issue.status === "resolved";
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-border bg-card p-2.5",
        issue.aiSuggestedClear && !isResolved && "border-emerald-300/60",
      )}
    >
      <Button
        size="icon"
        variant={isResolved ? "default" : "outline"}
        className="mt-0.5 size-6 shrink-0"
        onClick={isResolved ? onReopen : onResolve}
        aria-label={isResolved ? "未クリアに戻す" : "クリア（分かった！）"}
        title={isResolved ? "未クリアに戻す" : "クリア（分かった！）"}
      >
        {isResolved && <Check className="size-3" />}
      </Button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start gap-1.5">
          <SourceMiniBadge source={issue.source} />
          <p
            className={cn(
              "flex-1 text-sm leading-snug",
              isResolved && "text-muted-foreground line-through",
            )}
          >
            {issue.title}
          </p>
        </div>
        {issue.detail && !isResolved && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            {issue.detail}
          </p>
        )}
        {issue.aiSuggestedClear && !isResolved && (
          <p className="flex items-start gap-1 text-[11px] text-emerald-700">
            <Sparkles className="mt-0.5 size-3 shrink-0" />
            <span>AI: もうクリアして良さそう</span>
          </p>
        )}
      </div>
    </div>
  );
}

function SourceMiniBadge({ source }: { source: Issue["source"] }) {
  if (source === "self") {
    return (
      <Badge
        variant="outline"
        className="h-4 shrink-0 gap-0.5 border-blue-300/60 bg-blue-50 px-1 text-[9px] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
        title="本人発"
      >
        <UserIcon className="size-2" />
        本人
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="h-4 shrink-0 gap-0.5 border-purple-300/60 bg-purple-50 px-1 text-[9px] text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300"
      title="AI 発"
    >
      <Bot className="size-2" />
      AI
    </Badge>
  );
}
