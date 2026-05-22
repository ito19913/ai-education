"use client";

/**
 * PhilosophyView - PHILOSOPHY.md の中身をレンダリングする画面。
 * NotePane と同じマークダウン装飾を流用。
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  ChevronRight,
  Compass,
  Home,
  Quote,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const mdComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mt-6 mb-3 flex items-center gap-2 border-b border-border pb-2 text-2xl font-semibold text-foreground first:mt-0">
      <BookOpen className="size-6 text-primary" />
      <span>{children}</span>
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-5 mb-2 flex items-center gap-2 text-xl font-semibold text-foreground">
      <Sparkles className="size-5 text-primary" />
      <span>{children}</span>
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-4 mb-1.5 flex items-center gap-1.5 text-base font-semibold text-foreground">
      <ChevronRight className="size-4 text-primary" />
      <span>{children}</span>
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-3 text-base leading-relaxed text-card-foreground">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-3 flex flex-col gap-1.5 text-base text-card-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-3 ml-1 flex list-decimal flex-col gap-1.5 pl-6 text-base text-card-foreground marker:font-semibold marker:text-primary">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
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
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
      {children}
    </code>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-4 flex gap-2 rounded-md border-l-4 border-primary bg-primary/5 p-4 text-base italic text-muted-foreground">
      <Quote className="size-5 shrink-0 text-primary/60" />
      <div className="flex-1">{children}</div>
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-muted/50">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-border px-3 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-border px-3 py-2">{children}</td>
  ),
};

export function PhilosophyView({ content }: { content: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Compass className="size-6 text-primary" />
          <div className="flex-1">
            <h1 className="text-base font-semibold">
              AI-Education の憲法
            </h1>
            <p className="text-xs text-muted-foreground">
              本ツールが何のためにあるか — 学習を始める前に確認する場所
            </p>
          </div>
          <Link href="/learn">
            <Button variant="outline" size="sm" className="gap-2">
              <Home className="size-4" />
              <span>学習画面に戻る</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Card>
          <CardContent className={cn("py-8")}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={mdComponents}
            >
              {content}
            </ReactMarkdown>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
