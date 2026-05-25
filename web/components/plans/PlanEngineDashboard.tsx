"use client";

/**
 * PlanEngineDashboard - /tutor?view=plans の右ペインに展開される
 * Plan Engine 司令室 (C21 Phase 5 P5-Q6)。
 *
 * 構成 (左サイドリスト + 右パネル):
 *   - 左: LearningPlan[] 一覧 (active / paused、科目アイコン付き、選択中ハイライト)
 *   - 右: 選択 plan の詳細
 *       - 概要 (タイトル / 期間 / 進捗バー: 今月% + 全体%)
 *       - 全期間ロードマップ (月単位タブ、現在月 + 前後を強調)
 *       - 弱いノード一覧 (PLAN_MODE_DISTRIBUTION の primary mode と紐付け表示)
 *       - pending Suggestion + 最近の Interrupt
 *       - 修正履歴 (PlanRevision タイムライン)
 *
 * 親可視性 (P5-Q6 確定): 本人専用。admin (親) は週次/月次レポート経由のみ。
 * このコンポーネントは learner ロール想定で表示する。
 *
 * 動線:
 *   - 「[新しい計画 (+)]」ボタン → ゆい chat の「計画立てる」発話を裏で送る
 *   - 「完了済を表示」トグル → status: "completed" を一覧に含める
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Flag,
  History,
  Layers,
  Plus,
  RefreshCw,
  Target,
} from "lucide-react";
import {
  MOCK_GENERATED_TASKS,
  MOCK_INTERRUPT_EVENTS,
  MOCK_LEARNING_PLANS,
  MOCK_NODE_REVIEW_SUGGESTIONS,
  MOCK_SUBJECTS,
} from "@/lib/learn/mock-data";
import {
  PLAN_MODE_DISTRIBUTION,
  PLAN_TYPE_LABELS,
} from "@/lib/learn/plan-mode-matrix";
import type {
  GeneratedTask,
  InterruptEvent,
  KnowledgeNode,
  LearningPlan,
  NodeReviewSuggestion,
  PlanRevision,
  PlanType,
} from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  nodes: KnowledgeNode[];
};

export function PlanEngineDashboard({ nodes }: Props) {
  const [showCompleted, setShowCompleted] = useState(false);
  const plans = useMemo(() => {
    const filtered = MOCK_LEARNING_PLANS.filter(
      (p) => showCompleted || p.status !== "completed",
    );
    // active 優先、その後 paused、completed
    return [...filtered].sort((a, b) => statusOrder(a.status) - statusOrder(b.status));
  }, [showCompleted]);

  const [selectedId, setSelectedId] = useState<string | null>(
    plans[0]?.id ?? null,
  );
  const selected = plans.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      <Header
        showCompleted={showCompleted}
        onToggleCompleted={() => setShowCompleted((v) => !v)}
      />
      <div className="flex min-h-0 flex-1">
        {/* 左サイドリスト */}
        <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-border bg-background/40 p-3">
          <PlanList
            plans={plans}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>

        {/* 右パネル */}
        <main className="min-w-0 flex-1 overflow-y-auto p-5">
          {selected ? (
            <PlanDetailPanel plan={selected} nodes={nodes} />
          ) : (
            <EmptyPanel />
          )}
        </main>
      </div>
    </div>
  );
}

function statusOrder(s: "active" | "paused" | "completed"): number {
  return s === "active" ? 0 : s === "paused" ? 1 : 2;
}

function Header({
  showCompleted,
  onToggleCompleted,
}: {
  showCompleted: boolean;
  onToggleCompleted: () => void;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-background px-5 py-3">
      <div className="flex flex-1 items-center gap-2">
        <Layers className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Plan Engine</h2>
        <span className="text-[11px] text-muted-foreground">
          学習戦略エンジン (Phase 5)
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-[10px]"
        onClick={onToggleCompleted}
      >
        {showCompleted ? "完了済を隠す" : "完了済を表示"}
      </Button>
      <Link href="/tutor">
        <Button size="sm" className="h-7 gap-1 px-2 text-[10px]">
          <Plus className="size-3" />
          <span>新しい計画</span>
        </Button>
      </Link>
    </header>
  );
}

function PlanList({
  plans,
  selectedId,
  onSelect,
}: {
  plans: LearningPlan[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (plans.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        まだ計画がないよ。「新しい計画 +」から立てる。
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {plans.map((p) => {
        const subject = MOCK_SUBJECTS.find((s) => s.id === p.subjectId);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={cn(
              "flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left text-[12px] transition-colors",
              selectedId === p.id
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <div className="flex items-center gap-1.5">
              <BookOpen className="size-3 text-primary" />
              <span className="font-medium">{subject?.name ?? p.subjectId}</span>
              <StatusBadge status={p.status} />
            </div>
            <span className="line-clamp-2 text-[11px] text-muted-foreground">
              {p.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "paused" | "completed" }) {
  const map = {
    active: { label: "進行中", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
    paused: { label: "一時停止", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
    completed: { label: "完了", color: "bg-muted text-muted-foreground" },
  } as const;
  const m = map[status];
  return (
    <span className={cn("ml-auto rounded-full px-1.5 py-0 text-[9px] font-medium", m.color)}>
      {m.label}
    </span>
  );
}

function EmptyPanel() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center">
        <Flag className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          計画を選んでね。
        </p>
      </CardContent>
    </Card>
  );
}

function PlanDetailPanel({
  plan,
  nodes,
}: {
  plan: LearningPlan;
  nodes: KnowledgeNode[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <OverviewSection plan={plan} />
      <RoadmapSection plan={plan} />
      <WeakNodesSection plan={plan} nodes={nodes} />
      <SuggestionsAndInterruptsSection nodes={nodes} />
      <RevisionHistorySection plan={plan} />
    </div>
  );
}

function OverviewSection({ plan }: { plan: LearningPlan }) {
  // 全 GT のうち、本 plan に紐づく + 完了 (done) の割合 = 全体進捗
  const planGts = MOCK_GENERATED_TASKS.filter((g) => g.planId === plan.id);
  const doneGts = planGts.filter((g) => g.status === "done").length;
  const totalGts = planGts.length;
  const overallPct = totalGts > 0 ? Math.round((doneGts / totalGts) * 100) : 0;

  // 今月分の進捗
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthGts = planGts.filter((g) =>
    (g.scheduledDate ?? g.dueDate).startsWith(currentMonth),
  );
  const monthDone = monthGts.filter((g) => g.status === "done").length;
  const monthPct = monthGts.length > 0 ? Math.round((monthDone / monthGts.length) * 100) : 0;

  const planTypeMeta = plan.planType
    ? PLAN_TYPE_LABELS[plan.planType]
    : PLAN_TYPE_LABELS["regular-study"];

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-1 flex-col gap-0.5">
            <h3 className="text-sm font-semibold">{plan.title}</h3>
            <p className="text-[11px] text-muted-foreground">
              {plan.startDate} 〜 {plan.endDate} ・ {planTypeMeta.label}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {plan.currentRotation} / {plan.targetRotations} 回転目
          </Badge>
        </div>

        {/* 進捗バー 2 段 */}
        <div className="flex flex-col gap-2 pt-2">
          <ProgressBar label={`今月 (${currentMonth})`} pct={monthPct} count={`${monthDone} / ${monthGts.length}`} />
          <ProgressBar label="全体" pct={overallPct} count={`${doneGts} / ${totalGts}`} />
        </div>

        <p className="mt-1 text-[10px] italic text-muted-foreground">
          {planTypeMeta.description}
        </p>
      </CardContent>
    </Card>
  );
}

function ProgressBar({
  label,
  pct,
  count,
}: {
  label: string;
  pct: number;
  count: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">
          {pct}% <span className="text-[10px] text-muted-foreground">({count} GT)</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RoadmapSection({ plan }: { plan: LearningPlan }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <SectionTitle icon={<CalendarDays className="size-3.5" />} label="全期間ロードマップ" />
        <div className="flex flex-wrap gap-1.5">
          {plan.monthlyRoadmap.map((seg) => {
            const isCurrent = seg.month === currentMonth;
            const expanded = plan.expandedMonths.some(
              (m) => m.month === seg.month,
            );
            return (
              <div
                key={seg.month}
                className={cn(
                  "flex flex-col gap-0.5 rounded-md border px-2.5 py-1.5 text-[11px]",
                  isCurrent
                    ? "border-primary bg-primary/10"
                    : expanded
                      ? "border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                      : "border-border bg-card",
                )}
              >
                <span className="font-semibold tabular-nums">{seg.month}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {seg.targetPages}p
                  {seg.startPage && seg.endPage
                    ? ` (p.${seg.startPage}-${seg.endPage})`
                    : ""}
                </span>
                {isCurrent && <span className="text-[9px] font-medium text-primary">今月</span>}
                {!isCurrent && expanded && (
                  <span className="text-[9px] text-emerald-700 dark:text-emerald-400">展開済</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function WeakNodesSection({
  plan,
  nodes,
}: {
  plan: LearningPlan;
  nodes: KnowledgeNode[];
}) {
  const ids = plan.weakNodeIds ?? [];
  if (ids.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <SectionTitle icon={<Target className="size-3.5" />} label="弱いノード (重点練習)" />
          <p className="text-[11px] text-muted-foreground">
            登録なし。週次レポートから候補を [追加] するか、ゆいに「ここ弱い」と話して追加。
          </p>
        </CardContent>
      </Card>
    );
  }
  const planType = plan.planType ?? "regular-study";
  const primaryModes = (Object.keys(PLAN_MODE_DISTRIBUTION[planType]) as Array<keyof typeof PLAN_MODE_DISTRIBUTION[PlanType]>).filter(
    (m) => PLAN_MODE_DISTRIBUTION[planType][m] === "primary",
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <SectionTitle icon={<Target className="size-3.5" />} label="弱いノード (重点練習)" />
        <div className="flex flex-col gap-1.5">
          {ids.map((nid) => {
            const node = nodes.find((n) => n.id === nid);
            if (!node) return null;
            return (
              <div
                key={nid}
                className="flex items-center gap-2 rounded-md border border-amber-300/40 bg-amber-50/60 px-3 py-2 text-[12px] dark:border-amber-900/60 dark:bg-amber-950/30"
              >
                <Target className="size-3 shrink-0 text-amber-600" />
                <span className="flex-1 font-medium">{node.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  primary: {primaryModes.join(" / ") || "—"}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionsAndInterruptsSection({
  nodes,
}: {
  nodes: KnowledgeNode[];
}) {
  const pendingSuggestions = MOCK_NODE_REVIEW_SUGGESTIONS.filter(
    (s) => s.status === "pending",
  );
  const recentInterrupts = MOCK_INTERRUPT_EVENTS.slice(-3).reverse();

  if (pendingSuggestions.length === 0 && recentInterrupts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <SectionTitle icon={<ArrowUpRight className="size-3.5" />} label="保留中 / 最近のイベント" />

        {pendingSuggestions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
              復習提案 ({pendingSuggestions.length} 件 pending)
            </p>
            {pendingSuggestions.map((s) => (
              <SuggestionRow key={s.id} suggestion={s} nodes={nodes} />
            ))}
          </div>
        )}

        {recentInterrupts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-sky-700 dark:text-sky-400">
              最近の割込み ({recentInterrupts.length} 件)
            </p>
            {recentInterrupts.map((e) => (
              <InterruptRow key={e.id} event={e} />
            ))}
          </div>
        )}

        {/* C19/C20 整合: chat に飛ばす動線 */}
        {pendingSuggestions.length > 0 && (
          <Link
            href="/tutor"
            className="text-[10px] text-amber-700 underline hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
          >
            ゆいに対応してもらう →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function SuggestionRow({
  suggestion,
  nodes,
}: {
  suggestion: NodeReviewSuggestion;
  nodes: KnowledgeNode[];
}) {
  const failed = nodes.find((n) => n.id === suggestion.failedNodeId);
  const parent = nodes.find((n) => n.id === suggestion.suggestedParentNodeId);
  if (!failed || !parent) return null;
  return (
    <div className="rounded-md border border-amber-300/40 bg-amber-50/60 px-2.5 py-1.5 text-[11px] dark:border-amber-900/60 dark:bg-amber-950/30">
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{failed.name}</span>
        <ArrowUpRight className="size-3 text-amber-600" />
        <span className="font-semibold">{parent.name}</span>
        <span className="ml-auto text-[9px] text-muted-foreground">
          {suggestion.triggerType}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
        {suggestion.reason}
      </p>
    </div>
  );
}

function InterruptRow({ event }: { event: InterruptEvent }) {
  return (
    <div className="rounded-md border border-sky-300/40 bg-sky-50/60 px-2.5 py-1.5 text-[11px] dark:border-sky-900/60 dark:bg-sky-950/30">
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{event.title}</span>
        <span className="ml-auto rounded-full border border-sky-300 px-1.5 py-0 text-[9px] dark:border-sky-700">
          {event.type}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{event.affectedDate ?? event.occurredAt.slice(0, 10)}</span>
        {event.replanTriggered && (
          <span className="text-emerald-700 dark:text-emerald-400">
            ✓ Replan 処理済
          </span>
        )}
      </div>
    </div>
  );
}

function RevisionHistorySection({ plan }: { plan: LearningPlan }) {
  const revisions = plan.revisions;
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <SectionTitle icon={<History className="size-3.5" />} label="修正履歴 (PlanRevision)" />
        {revisions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            まだ修正なし。Replan が走ったら自動でここに記録される。
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {[...revisions]
              .sort((a, b) => (a.revisedAt < b.revisedAt ? 1 : -1))
              .map((r) => (
                <RevisionRow key={r.id} revision={r} />
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RevisionRow({ revision }: { revision: PlanRevision }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px]">
      <RefreshCw className="mt-0.5 size-3 shrink-0 text-sky-600" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">
            {revision.revisedAt.slice(0, 10)}
          </span>
          <span className="rounded-full border border-border px-1.5 py-0 text-[9px] text-muted-foreground">
            {revision.triggeredBy}
          </span>
        </div>
        <p className="text-card-foreground">{revision.reason}</p>
        {revision.changedFields.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            変更: {revision.changedFields.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}

// 未使用シンボル防止 (型 export を残す)
export type { GeneratedTask };
