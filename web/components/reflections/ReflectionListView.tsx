"use client";

/**
 * ReflectionListView - 振り返りログの一覧画面（Phase 3 レビュー追従 C4）。
 *
 * 主動線: ゆい chat で「振り返りログ見せて」「ふりかえり一覧」等と発話 →
 * tutor-mock の keyword 分岐 → /tutor?view=reflections に右ペインを切替。
 *
 * 設計:
 * - 日付降順に並べた日記レイアウト
 * - cadence (daily/weekly/monthly) でフィルタ
 * - 各カードに 5 セクション + 派生リンク (Issue / TutorHandoff) を表示
 * - 派生リンクは Issue 一覧 (右ペイン) や IssueChat にジャンプできる
 * - 読み取り中心。編集は別画面（朝の振り返り対話）で発生する
 *
 * mock データソース:
 * - MOCK_REFLECTION_LOGS: 静的 7 日分 (C2) + ランタイム派生 (C3)
 * - MOCK_ISSUES: derivedIssueIds の解決
 * - MOCK_HANDOFFS: derivedHandoffIds の解決
 *
 * Phase 7 で Supabase 化する時、props で受け取る形にリファクタする。
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Calendar,
  CalendarDays,
  ClipboardList,
  Clock,
  HeartHandshake,
  HelpCircle,
  NotebookPen,
  Send,
  Target,
} from "lucide-react";
import {
  MOCK_HANDOFFS,
  MOCK_ISSUES,
  MOCK_REFLECTION_LOGS,
} from "@/lib/learn/mock-data";
import type {
  KnowledgeNode,
  ReflectionCadence,
  ReflectionLog,
  Subject,
} from "@/lib/learn/types";
import { MarkdownText } from "@/components/chat/MarkdownText";
import { cn } from "@/lib/utils";

type Props = {
  nodes: KnowledgeNode[];
  subjects: Subject[];
};

type CadenceFilter = "all" | ReflectionCadence;

const CADENCE_FILTERS: Array<{ value: CadenceFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "daily", label: "日次" },
  { value: "weekly", label: "週次" },
  { value: "monthly", label: "月次" },
];

export function ReflectionListView({ nodes, subjects }: Props) {
  const [filter, setFilter] = useState<CadenceFilter>("all");

  const sorted = useMemo(() => {
    // 日付降順 (同日内では createdAt 降順)
    return [...MOCK_REFLECTION_LOGS].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return sorted;
    return sorted.filter((r) => r.cadence === filter);
  }, [sorted, filter]);

  const counts = useMemo(() => {
    const out: Record<CadenceFilter, number> = {
      all: sorted.length,
      daily: 0,
      weekly: 0,
      monthly: 0,
    };
    for (const r of sorted) out[r.cadence] += 1;
    return out;
  }, [sorted]);

  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      {/* ヘッダ */}
      <header className="border-b border-border bg-background px-5 py-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            振り返りログ
          </h2>
          <span className="text-[11px] text-muted-foreground">
            （全 {sorted.length} 件
            {filter !== "all" && ` / 表示 ${filtered.length} 件`}）
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          朝の振り返り 5 セクションと、そこから派生した課題・申し送りを日付ごとに集約。
        </p>
      </header>

      {/* フィルタ */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/20 px-5 py-3">
        <span className="mr-1 text-[10px] font-medium text-muted-foreground">
          周期:
        </span>
        {CADENCE_FILTERS.map((f) => {
          const active = filter === f.value;
          const count = counts[f.value];
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={
                active
                  ? "inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground"
                  : "inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 text-[9px] font-semibold",
                  active ? "bg-primary-foreground/20" : "bg-muted",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 一覧 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-5">
          {filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <NotebookPen className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  この周期の振り返りはまだありません。
                </p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((log) => (
              <ReflectionCard
                key={log.id}
                log={log}
                nodes={nodes}
                subjects={subjects}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ReflectionCard({
  log,
  nodes,
  subjects,
}: {
  log: ReflectionLog;
  nodes: KnowledgeNode[];
  subjects: Subject[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <CadenceBadge cadence={log.cadence} />
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatDate(log.date)}
          </span>
          {log.cadence === "weekly" && log.weekStart && (
            <span className="text-[11px] text-muted-foreground">
              (週: {formatDate(log.weekStart)} 〜)
            </span>
          )}
        </div>

        {log.yesterdayReview && (
          <Section
            icon={<Clock className="size-3.5" />}
            label={
              log.cadence === "daily"
                ? "昨日のレビュー"
                : log.cadence === "weekly"
                  ? "今週のレビュー"
                  : "今月のレビュー"
            }
            text={log.yesterdayReview}
          />
        )}
        {log.schoolToday && (
          <Section
            icon={<BookOpen className="size-3.5" />}
            label="学校で習ったこと"
            text={log.schoolToday}
          />
        )}
        {log.emotionsAndEvents && (
          <Section
            icon={<HeartHandshake className="size-3.5" />}
            label="気分・出来事"
            text={log.emotionsAndEvents}
          />
        )}
        {log.questionsAndDoubts && (
          <Section
            icon={<HelpCircle className="size-3.5" />}
            label="疑問・不安"
            text={log.questionsAndDoubts}
          />
        )}
        {log.todayPlan && (
          <Section
            icon={<Calendar className="size-3.5" />}
            label={
              log.cadence === "daily"
                ? "今日の計画"
                : log.cadence === "weekly"
                  ? "来週の計画"
                  : "来月の計画"
            }
            text={log.todayPlan}
          />
        )}

        {/* 派生リンク */}
        {(log.derivedIssueIds?.length || log.derivedHandoffIds?.length) && (
          <DerivedLinks
            issueIds={log.derivedIssueIds ?? []}
            handoffIds={log.derivedHandoffIds ?? []}
            nodes={nodes}
            subjects={subjects}
          />
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  icon,
  label,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-card-foreground">
        <MarkdownText text={text} variant="card" />
      </div>
    </div>
  );
}

function CadenceBadge({ cadence }: { cadence: ReflectionCadence }) {
  const map: Record<
    ReflectionCadence,
    { label: string; cls: string }
  > = {
    daily: {
      label: "日次",
      cls: "border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    },
    weekly: {
      label: "週次",
      cls: "border-sky-300/60 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
    },
    monthly: {
      label: "月次",
      cls: "border-violet-300/60 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300",
    },
  };
  const { label, cls } = map[cadence];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[10px]", cls)}
    >
      <CalendarDays className="size-2.5" />
      <span>{label}</span>
    </Badge>
  );
}

function DerivedLinks({
  issueIds,
  handoffIds,
  nodes,
  subjects,
}: {
  issueIds: string[];
  handoffIds: string[];
  nodes: KnowledgeNode[];
  subjects: Subject[];
}) {
  const issues = MOCK_ISSUES.filter((i) => issueIds.includes(i.id));
  const handoffs = MOCK_HANDOFFS.filter((h) => handoffIds.includes(h.id));
  if (issues.length === 0 && handoffs.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-dashed border-border bg-card/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <ClipboardList className="size-3.5" />
        <span>ここから派生</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {issues.map((issue) => {
          const nodeName =
            nodes.find((n) => n.id === issue.nodeId)?.name ?? issue.nodeId;
          return (
            <Link
              key={issue.id}
              href={`/tutor?view=issue&id=${encodeURIComponent(issue.id)}`}
              className="inline-flex items-center gap-1 rounded-full border border-orange-300/60 bg-orange-50 px-2 py-0.5 text-[10px] text-orange-700 transition-colors hover:border-orange-500 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300"
              title={issue.title}
            >
              <Target className="size-2.5" />
              <span className="max-w-[180px] truncate">{issue.title}</span>
              <span className="opacity-60">({nodeName})</span>
            </Link>
          );
        })}
        {handoffs.map((handoff) => {
          const subjectName =
            subjects.find((s) => s.id === handoff.toSubjectId)?.name ?? "葵";
          return (
            <span
              key={handoff.id}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                handoff.status === "unread"
                  ? "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-border bg-muted text-muted-foreground",
              )}
              title={handoff.title}
            >
              <Send className="size-2.5" />
              <span className="max-w-[180px] truncate">{handoff.title}</span>
              <span className="opacity-60">→{subjectName}</span>
              {handoff.status === "unread" && (
                <span className="ml-0.5 rounded-full bg-emerald-500/80 px-1 text-[9px] font-semibold text-white">
                  未読
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(yyyymmdd: string): string {
  // "2026-05-24" → "5/24 (日)"
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  if (!y || !m || !d) return yyyymmdd;
  const date = new Date(y, m - 1, d);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${m}/${d} (${weekday})`;
}
