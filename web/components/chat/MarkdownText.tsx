"use client";

/**
 * MarkdownText - chat バブル内で markdown をレンダリングする共通コンポーネント。
 *
 * 使用箇所（Phase 3 レビュー追従 2026-05-24 で導入）:
 * - ゆい先生 chat (TutorMessageBubble)
 * - 葵先生 chat (DialogPane / IssueChatBubble)
 *
 * 設計方針:
 * - chat バブル内に収まるコンパクトな装飾（PhilosophyView/NotePane より小ぶり）
 * - variant="bubble-primary" は learner 発話用（背景 primary 色）→ 強調色を反転
 * - react-markdown + remark-gfm。HTML タグはデフォルトで通さない（XSS 防止）
 *
 * Phase 6 (Claude API 化) で AI 発話が **太字** や箇条書きを返してきても、
 * このコンポーネント 1 つで全 chat の表示が揃う。
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Variant = "card" | "bubble-primary";

type Props = {
  text: string;
  variant?: Variant;
  className?: string;
};

const cardComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-1 leading-relaxed first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-1.5 flex list-disc flex-col gap-0.5 pl-5 marker:text-primary first:mt-0 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-1.5 flex list-decimal flex-col gap-0.5 pl-5 marker:font-medium marker:text-primary first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="rounded bg-primary/15 px-0.5 font-semibold">
      {children}
    </strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground first:mt-0 last:mb-0">
      {children}
    </blockquote>
  ),
  // chat 内に h1/h2/h3 が来る想定は薄いが、来ても文章として崩れないよう統一
  h1: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-1 text-base font-semibold first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-1 text-base font-semibold first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-1 font-semibold first:mt-0 last:mb-0">{children}</p>
  ),
  hr: () => <hr className="my-2 border-border" />,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      className="underline underline-offset-2"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto first:mt-0 last:mb-0">
      <table className="w-full border-collapse text-[0.95em]">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-border px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-border px-2 py-1">{children}</td>
  ),
};

// learner 発話 (背景 = primary) 用。強調色を反転して可読性を維持。
const bubblePrimaryComponents = {
  ...cardComponents,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="rounded bg-primary-foreground/25 px-0.5 font-semibold">
      {children}
    </strong>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-primary-foreground/40 pl-3 italic opacity-90 first:mt-0 last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-primary-foreground/15 px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-1.5 flex list-disc flex-col gap-0.5 pl-5 marker:text-primary-foreground/70 first:mt-0 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-1.5 flex list-decimal flex-col gap-0.5 pl-5 marker:font-medium marker:text-primary-foreground/70 first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
};

export function MarkdownText({ text, variant = "card", className }: Props) {
  const components =
    variant === "bubble-primary" ? bubblePrimaryComponents : cardComponents;
  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/**
 * preview 用: markdown 記法 (`**bold**` 等) を平文に変換。
 *
 * SubjectHistoryView の line-clamp 付き preview で使う想定。
 * markdown レンダリングすると改行・見出しが入って line-clamp が期待通り動かないため、
 * preview では装飾を剥がして「文字列としての可読性」だけ確保する。
 *
 * 完全な markdown パーサではなく、よく使う記法だけカバーする最小実装。
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+?)_(?!_)/g, "$1")
    .replace(/`([^`\n]+?)`/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");
}
