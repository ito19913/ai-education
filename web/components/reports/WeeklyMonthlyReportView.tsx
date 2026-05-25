"use client";

/**
 * WeeklyMonthlyReportView - 週次/月次レポート (C11 Phase 4)。
 *
 * 4 セクション構造 (Q9 確定、達成感最優先のサンドイッチ):
 *   1. 達成度 (パーセンテージ + バッジ + 連続日数、最重要)
 *   2. 学校まとめ (SchoolDailyReport 集約 + AI 要約)
 *   3. 弱いところ (Issue 点 + NodeComprehension 面、戻る候補)
 *   4. 来週/来月の計画 + Action (前向きな締め)
 * 月末週は + 月次達成度 + 来月計画 + 修正プラン draft が追加表示。
 *
 * データソース:
 *   - MOCK_REFLECTION_LOGS (cadence: "weekly" | "monthly")
 *   - MOCK_ACHIEVEMENT_BADGES / MOCK_SCHOOL_DAILY_REPORTS / MOCK_ISSUES / MOCK_NODE_COMPREHENSIONS
 *
 * 表示モード:
 *   - mode="weekly" → cadence="weekly" の最新を表示
 *   - mode="monthly" → cadence="monthly" の最新を表示
 *   - 日付セレクター (将来): URL ?date=YYYY-MM-DD で特定日にジャンプ可
 */
import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Flag,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  MOCK_ACHIEVEMENT_BADGES,
  MOCK_ISSUES,
  MOCK_NODE_COMPREHENSIONS,
  MOCK_REFLECTION_LOGS,
  MOCK_SCHOOL_DAILY_REPORTS,
} from "@/lib/learn/mock-data";
import type {
  AchievementBadge,
  KnowledgeNode,
  ReflectionLog,
  Subject,
  WeeklyMonthlyReport,
} from "@/lib/learn/types";
import { MarkdownText } from "@/components/chat/MarkdownText";
import { cn } from "@/lib/utils";

type Props = {
  mode: "weekly" | "monthly";
  nodes: KnowledgeNode[];
  subjects: Subject[];
};

export function WeeklyMonthlyReportView({ mode, nodes }: Props) {
  const log = useMemo(() => {
    const candidates = MOCK_REFLECTION_LOGS.filter((r) => r.cadence === mode);
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  }, [mode]);

  if (!log || !log.weeklyMonthlyReport) {
    return (
      <div className="flex h-full w-full flex-col bg-canvas">
        <Header mode={mode} />
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <Flag className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                まだ {mode === "weekly" ? "週次" : "月次"} レポートがありません。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const report = log.weeklyMonthlyReport;

  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      <Header mode={mode} date={log.date} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-5">
          <AchievementSection report={report} />
          <SchoolSummarySection report={report} />
          <WeakSpotsSection report={report} nodes={nodes} />
          <NextPlanSection report={report} />
          {report.nextMonthPlan && <NextMonthPlanSection report={report} />}
        </div>
      </div>
    </div>
  );
}

function Header({ mode, date }: { mode: "weekly" | "monthly"; date?: string }) {
  return (
    <header className="border-b border-border bg-background px-5 py-3">
      <div className="flex items-center gap-2">
        <Flag className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          {mode === "weekly" ? "週次レポート" : "月次レポート"}
        </h2>
        {date && (
          <span className="text-[11px] text-muted-foreground">({date})</span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        一緒に読もう。**達成 → 学校 → 弱いところ → 来週の計画** の順だよ。
      </p>
    </header>
  );
}

/** セクション 1: 達成度 */
function AchievementSection({ report }: { report: WeeklyMonthlyReport }) {
  const a = report.achievement;
  const trend =
    a.previousPeriodPct !== undefined
      ? a.achievementPct - a.previousPeriodPct
      : null;

  return (
    <Card className="border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20">
      <CardContent className="flex flex-col gap-3 py-4">
        <SectionTitle
          icon={<Target className="size-3.5" />}
          label="達成度"
          color="amber"
        />

        {/* メイン達成率 */}
        <div className="flex flex-col items-center gap-1 py-2">
          <div className="text-4xl font-bold tabular-nums text-amber-600 dark:text-amber-300">
            {a.achievementPct}%
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            計画 {a.plannedPages}p / 実績 {a.actualPages}p
          </div>
          {trend !== null && (
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] font-medium tabular-nums",
                trend >= 0 ? "text-emerald-600" : "text-orange-600",
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              <span>
                先週比 {trend > 0 ? "+" : ""}
                {trend}pt
              </span>
            </div>
          )}
        </div>

        {/* 連続日数 + バッジ */}
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300/40 bg-background/60 px-3 py-2">
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Sparkles className="size-2.5" />
            連続 {a.consecutiveDays} 日
          </Badge>
          {a.badgeIds.map((badgeId) => {
            const badge = MOCK_ACHIEVEMENT_BADGES.find((b) => b.id === badgeId);
            if (!badge) return null;
            return <BadgeChip key={badge.id} badge={badge} />;
          })}
        </div>

        {/* 月末週: 月次達成度 */}
        {a.monthlyAchievement && (
          <div className="rounded-md border border-amber-300/40 bg-background/60 px-3 py-2 text-[12px]">
            <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <CalendarDays className="size-3" />
              <span>今月の達成度</span>
            </div>
            <div className="flex items-center justify-between">
              <span>計画 {a.monthlyAchievement.plannedPages}p / 実績 {a.monthlyAchievement.actualPages}p</span>
              <span className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-300">
                {a.monthlyAchievement.achievementPct}%
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BadgeChip({ badge }: { badge: AchievementBadge }) {
  return (
    <Badge
      variant="outline"
      className="gap-1 border-emerald-300/60 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      title={`${badge.kind} - ${badge.earnedAt}`}
    >
      {badge.description}
    </Badge>
  );
}

/** セクション 2: 学校まとめ */
function SchoolSummarySection({
  report,
}: {
  report: WeeklyMonthlyReport;
}) {
  const s = report.schoolSummary;
  const reports = MOCK_SCHOOL_DAILY_REPORTS.filter((r) =>
    s.dailyReportIds.includes(r.id),
  ).sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <SectionTitle
          icon={<BookOpen className="size-3.5" />}
          label="学校まとめ"
          color="sky"
        />

        {/* AI 要約 */}
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <MarkdownText text={s.aiSummary} variant="card" />
        </div>

        {/* 日付別 SchoolDailyReport */}
        {reports.length > 0 && (
          <details className="text-[12px]">
            <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
              日別の中身を見る ({reports.length} 日)
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="rounded-md border border-border bg-card px-3 py-2"
                >
                  <div className="mb-1 flex items-center gap-2 text-[11px]">
                    <span className="font-semibold tabular-nums">{r.date}</span>
                    <span className="text-muted-foreground">
                      {r.periodCount} 時限
                    </span>
                  </div>
                  <ul className="ml-3 flex flex-col gap-0.5 text-[11px] text-card-foreground">
                    {r.periods.map((p) => (
                      <li key={p.periodNumber}>
                        <span className="font-medium">
                          {p.periodNumber}限 {p.subject}
                        </span>
                        : {p.content}
                      </li>
                    ))}
                  </ul>
                  {r.extraEvents && (
                    <p className="mt-1 text-[11px] italic text-muted-foreground">
                      {r.extraEvents}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

/** セクション 3: 弱いところ (Issue + NodeComprehension) */
function WeakSpotsSection({
  report,
  nodes,
}: {
  report: WeeklyMonthlyReport;
  nodes: KnowledgeNode[];
}) {
  const w = report.weakSpots;
  const issues = MOCK_ISSUES.filter((i) => w.issueIds.includes(i.id));
  const weakNodes = w.weakNodeIds
    .map((nid) => {
      const node = nodes.find((n) => n.id === nid);
      const nc = MOCK_NODE_COMPREHENSIONS.find((c) => c.nodeId === nid);
      return node && nc ? { node, nc } : null;
    })
    .filter((x): x is { node: KnowledgeNode; nc: typeof MOCK_NODE_COMPREHENSIONS[number] } => x !== null);

  if (issues.length === 0 && weakNodes.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-300/40">
      <CardContent className="flex flex-col gap-3 py-4">
        <SectionTitle
          icon={<Target className="size-3.5" />}
          label="弱いところ (戻る候補)"
          color="orange"
        />
        <p className="text-[11px] text-muted-foreground">
          会計士試験的に「具体的詰まり (点) + 体系の浅さ (面)」の 2 段で見るよ。
        </p>

        {issues.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              未クリア課題 ({issues.length} 件)
            </p>
            <div className="flex flex-col gap-1.5">
              {issues.map((issue) => {
                const nodeName =
                  nodes.find((n) => n.id === issue.nodeId)?.name ?? issue.nodeId;
                return (
                  <Link
                    key={issue.id}
                    href={`/tutor?view=issue&id=${encodeURIComponent(issue.id)}`}
                    className="flex items-center gap-2 rounded-md border border-orange-300/40 bg-orange-50 px-3 py-2 text-[12px] text-orange-800 transition-colors hover:border-orange-500 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300"
                  >
                    <Target className="size-3 shrink-0" />
                    <span className="flex-1 truncate">{issue.title}</span>
                    <span className="text-[10px] opacity-60">({nodeName})</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {weakNodes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              浅いノード ({weakNodes.length} 件)
            </p>
            <div className="flex flex-col gap-1.5">
              {weakNodes.map(({ node, nc }) => (
                <div
                  key={node.id}
                  className="rounded-md border border-amber-300/40 bg-amber-50/60 px-3 py-2 text-[12px] dark:border-amber-900/60 dark:bg-amber-950/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{node.name}</span>
                    <span className="tabular-nums text-amber-700 dark:text-amber-300">
                      score {Math.round(nc.score * 100)}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {nc.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** セクション 4: 来週/来月の計画 + Action */
function NextPlanSection({ report }: { report: WeeklyMonthlyReport }) {
  const n = report.nextPeriodPlan;
  return (
    <Card className="border-emerald-300/40 bg-emerald-50/30 dark:bg-emerald-950/20">
      <CardContent className="flex flex-col gap-3 py-4">
        <SectionTitle
          icon={<TrendingUp className="size-3.5" />}
          label="来週の計画 + Action"
          color="emerald"
        />

        <div className="rounded-md border border-emerald-300/40 bg-background/60 px-3 py-2 text-[12px]">
          <div className="flex justify-between">
            <span>来週の計画</span>
            <span className="font-semibold tabular-nums">{n.plannedPages} p</span>
          </div>
          {n.carryOver > 0 && (
            <div className="mt-0.5 flex justify-between text-orange-700 dark:text-orange-400">
              <span>繰り越し ★</span>
              <span className="font-semibold tabular-nums">+{n.carryOver} p</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold">
            <span>合計</span>
            <span className="tabular-nums">{n.totalPages} p</span>
          </div>
        </div>

        {n.actionProposals.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              Action 提案
            </p>
            {n.actionProposals.map((p, i) => (
              <div
                key={i}
                className="rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  <span>{p.detail}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {p.rationale}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** セクション 5 (月末週のみ): 来月計画 + 修正プラン draft */
function NextMonthPlanSection({ report }: { report: WeeklyMonthlyReport }) {
  const m = report.nextMonthPlan!;
  return (
    <Card className="border-violet-300/40 bg-violet-50/30 dark:bg-violet-950/20">
      <CardContent className="flex flex-col gap-3 py-4">
        <SectionTitle
          icon={<CalendarDays className="size-3.5" />}
          label="来月の計画"
          color="violet"
        />

        <div className="rounded-md border border-violet-300/40 bg-background/60 px-3 py-2 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">
              {m.monthlyRoadmap.month}
            </span>
            <span className="text-muted-foreground">
              {m.monthlyRoadmap.targetPages} p
            </span>
            {m.monthlyRoadmap.carryOverFromPrev ? (
              <span className="text-[10px] text-orange-700 dark:text-orange-400">
                繰越 +{m.monthlyRoadmap.carryOverFromPrev}p
              </span>
            ) : null}
          </div>
          {m.monthlyRoadmap.startPage && m.monthlyRoadmap.endPage && (
            <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
              p.{m.monthlyRoadmap.startPage} - {m.monthlyRoadmap.endPage}
            </p>
          )}
        </div>

        {m.revisionDraft && (
          <div className="rounded-md border border-orange-300/40 bg-orange-50/60 px-3 py-2 text-[12px] dark:border-orange-900/60 dark:bg-orange-950/30">
            <p className="mb-1 text-[11px] font-medium text-orange-700 dark:text-orange-300">
              修正プラン draft (AI 提案)
            </p>
            <p className="text-foreground">{m.revisionDraft.reason}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              triggered by: {m.revisionDraft.triggeredBy}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionTitle({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: "amber" | "sky" | "orange" | "emerald" | "violet";
}) {
  const colorMap: Record<typeof color, string> = {
    amber: "text-amber-700 dark:text-amber-300",
    sky: "text-sky-700 dark:text-sky-300",
    orange: "text-orange-700 dark:text-orange-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    violet: "text-violet-700 dark:text-violet-300",
  };
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-[12px] font-semibold",
        colorMap[color],
      )}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
