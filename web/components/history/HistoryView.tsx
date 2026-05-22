"use client";

/**
 * HistoryView - 学習履歴の一覧表示。
 * - 上部: 週/月/科目別 集計サマリー
 * - 中段: カード表示 / カレンダー表示の切替
 */
import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Check,
  Clock,
  HelpCircle,
  History,
  Home,
  LayoutList,
  MessageSquare,
  Pencil,
  Sparkles,
  Target,
} from "lucide-react";
import type {
  KnowledgeNode,
  LearningSession,
  SessionEndReason,
  Subject,
} from "@/lib/learn/types";
import { formatElapsed } from "@/lib/learn/use-learning-session";
import { HistorySummary } from "./HistorySummary";
import { HistoryCalendarView } from "./HistoryCalendarView";

type Props = {
  sessions: LearningSession[];
  nodes: KnowledgeNode[];
  subjects: Subject[];
};

type ViewMode = "cards" | "calendar";

const REASON_LABELS: Record<SessionEndReason, string> = {
  manual: "明示終了",
  "auto-idle": "操作なし自動",
  "auto-day-change": "日付変更",
  "browser-close": "ブラウザ閉じ",
};

export function HistoryView({ sessions, nodes, subjects }: Props) {
  const [mode, setMode] = useState<ViewMode>("cards");
  const nameOf = (id: string) =>
    nodes.find((n) => n.id === id)?.name ?? id;

  // 日付降順
  const sorted = [...sessions].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <History className="size-5 text-primary" />
          <div className="flex-1">
            <h1 className="text-base font-semibold">学習履歴</h1>
            <p className="text-xs text-muted-foreground">
              これまでの学習セッションの記録 ({sorted.length} 件)
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

      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-6">
        {/* 集計サマリー（週/月/科目別） */}
        <HistorySummary sessions={sessions} subjects={subjects} />

        {/* 表示モード切替 */}
        <div className="flex items-center gap-2">
          <Button
            variant={mode === "cards" ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setMode("cards")}
          >
            <LayoutList className="size-3.5" />
            <span>カード</span>
          </Button>
          <Button
            variant={mode === "calendar" ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setMode("calendar")}
          >
            <CalendarDays className="size-3.5" />
            <span>カレンダー</span>
          </Button>
        </div>

        {mode === "calendar" && (
          <HistoryCalendarView sessions={sessions} />
        )}

        {mode === "cards" && sorted.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <History className="mx-auto size-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                まだ学習履歴がありません
              </p>
            </CardContent>
          </Card>
        )}

        {mode === "cards" && sorted.map((s) => {
          const elapsedSec = s.endedAt
            ? Math.floor(
                (new Date(s.endedAt).getTime() -
                  new Date(s.startedAt).getTime()) /
                  1000,
              )
            : 0;
          const startDate = new Date(s.startedAt);
          return (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>
                    {startDate.toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {startDate.toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    開始
                    {s.endReason && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {REASON_LABELS[s.endReason]}
                      </Badge>
                    )}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat
                    icon={<Clock className="size-3.5 text-primary" />}
                    label="学習時間"
                    value={formatElapsed(elapsedSec)}
                  />
                  <Stat
                    icon={<Target className="size-3.5 text-primary" />}
                    label="訪れたノード"
                    value={`${new Set(s.visitedNodeIds).size}`}
                    unit="個"
                  />
                  <Stat
                    icon={
                      <MessageSquare className="size-3.5 text-primary" />
                    }
                    label="対話"
                    value={`${s.messageCount}`}
                    unit="回"
                  />
                  <Stat
                    icon={<Pencil className="size-3.5 text-primary" />}
                    label="ノート編集"
                    value={`${s.noteEditCount}`}
                    unit="回"
                  />
                </div>

                {s.visitedNodeIds.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-muted-foreground">
                      学習した範囲 — クリックでチャットへ
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(new Set(s.visitedNodeIds)).map((id) => (
                        <Link
                          key={id}
                          href={`/learn?node=${encodeURIComponent(id)}`}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-card-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                        >
                          <MessageSquare className="size-3" />
                          <span>{nameOf(id)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {s.summary && (
                  <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Sparkles className="size-3.5" />
                      <span>AI による学習まとめ</span>
                    </p>
                    {s.summary.learned.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-muted-foreground">
                          学んだこと
                        </p>
                        <ul className="flex flex-col gap-1 text-xs text-card-foreground">
                          {s.summary.learned.map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {s.summary.questions.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-muted-foreground">
                          疑問点 — 次回確認すると良い
                        </p>
                        <ul className="flex flex-col gap-1 text-xs text-card-foreground">
                          {s.summary.questions.map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <HelpCircle className="mt-0.5 size-3 shrink-0 text-orange-600" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {s.reconstructionResult && (
                  <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs">
                    <span className="text-muted-foreground">
                      体系図 復元テスト:
                    </span>{" "}
                    <span className="font-semibold text-foreground">
                      {s.reconstructionResult.correctCount} /{" "}
                      {s.reconstructionResult.totalCount}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      (
                      {Math.round(
                        (s.reconstructionResult.correctCount /
                          s.reconstructionResult.totalCount) *
                          100,
                      )}
                      %)
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-card p-2.5">
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
        {value}
        {unit && (
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
