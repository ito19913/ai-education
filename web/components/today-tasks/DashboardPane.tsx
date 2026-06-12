"use client";

/**
 * DashboardPane - /tutor のトップ (右ペイン デフォルト) ダッシュボード。
 *
 * 2026-06-09 ito19 さん意見 + grill 確定:
 *   - トップ=ダッシュボードに統合。毎日の入口。左メニューは「ダッシュボード」だけ。
 *   - 各カード/セクションはクリックで該当画面へ (onNavigate)。
 *
 * ★2026-06-10 新プラン (ザックリ・まとまりキュー型) で今日のタスクを刷新★:
 *   - モックの今日のタスク (TodayTaskList/進捗バー/AIと相談) は撤去。画面に出るのは実物だけ。
 *   - 今日のタスク = 各アクティブプランの「先頭まとまり」が常駐 (完了で即次、溜まらない)。
 *   - 予定の「勉強」モックマージも撤去 (手動イベントだけの正直な表示)。
 *
 * ★2026-06-11 Phase B (grill B-7): 今日のタスクを 2 段に★:
 *   - 上段 = プランの「つぎのまとまり」(自動枠、従来どおり)。
 *   - 下段 = 「きょう決めたこと」(その日決める枠 = pick)。儀式で選んだ宿題・まとまり。
 *     完了は導出 (宿題 status / レジュメ understood)、完了日は ✓ → 翌日消える。
 *     「やめとく」で外せる。0 件の日は下段ごと非表示 (実データだけ規律)。
 *   - ヘッダー右「＋ゆいと決める」→ 左の chat で儀式開始。
 *
 * 構成 (上から、全て同じ中央寄せ幅):
 *   今日のタスク (プラン先頭 + きょう決めたこと) → 宿題・テスト → 予定 → 課題 → 教材 → レジュメ → プラン → 記録
 */
import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Book,
  BookOpen,
  BookText,
  Check,
  ClipboardList,
  Compass,
  GraduationCap,
  History,
  ListTodo,
  MessageSquare,
  NotebookPen,
  Paperclip,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { computePlanProgress, daysUntilEnd } from "@/lib/plans/plan-progress";
import type {
  AssignmentStatus,
  DailyPick,
  Issue,
  KnowledgeNode,
  Material,
  NoteEntry,
  RightPaneView,
  StudyPlan,
  Subject,
} from "@/lib/learn/types";
import { SchedulePanel, type CalendarApi } from "./SchedulePanel";

type Props = {
  /** 予定パネル (ラベル + 手動イベント + 操作) */
  calendar: CalendarApi;
  issues: Issue[];
  /** 課題の論点名解決用 */
  nodes: KnowledgeNode[];
  /** 教材セクション (本棚サムネ) + 宿題・テスト + プラン進捗 用 */
  materials: Material[];
  /** 教材データの表示状態 (2026-06-12: fetch 失敗を「0 件」と区別する)。省略時 ready 扱い */
  materialsLoadState?: "loading" | "error" | "ready";
  /** 宿題・テスト / プランの科目名解決用 */
  subjects: Subject[];
  /** レジュメ手応え集計 + プラン進捗導出 用 */
  noteEntries: NoteEntry[];
  /** 新プラン (今日のタスク = 各プランの先頭まとまり) */
  plans: StudyPlan[];
  /** Phase B: 「その日決める枠」の pick (きょう決めたこと) */
  dayPicks: DailyPick[];
  /** pick を外す (「やめとく」、B-5) */
  onRemoveDayPick: (id: string) => void;
  /** 「＋ゆいと決める」→ 左の chat で儀式開始 (B-1) */
  onStartDayRitual: () => void;
  /** 宿題・テストカードの「＋追加」→ その場登録ダイアログ (登録のみ) */
  onAddAssignmentQuick: () => void;
  /** 宿題 pick の「やった」チェック (既存宿題トグルと同じハンドラ) */
  onToggleAssignmentStatus: (id: string, status: AssignmentStatus) => void;
  /** ダッシュボード各カード/セクション → 該当ビューへ。TutorWorkspace の navigate を渡す */
  onNavigate: (
    view: RightPaneView,
    params?: {
      issueId?: string;
      materialId?: string;
      tab?: string;
      page?: number;
      unit?: boolean;
    },
  ) => void;
};

function daysUntil(dateStr: string): number {
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(dateStr);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function DashboardPane({
  calendar,
  issues,
  nodes,
  materials,
  materialsLoadState = "ready",
  subjects,
  noteEntries,
  plans,
  dayPicks,
  onRemoveDayPick,
  onStartDayRitual,
  onAddAssignmentQuick,
  onToggleAssignmentStatus,
  onNavigate,
}: Props) {
  const subjectName = (id: string) =>
    subjects.find((s) => s.id === id)?.name ?? "";

  // 今日のタスク = 各アクティブプランの先頭まとまり (実データ)
  const planTasks = useMemo(() => {
    return plans
      .filter((p) => p.status === "active" && !p.deletedAt)
      .map((p) => {
        const material = materials.find((m) => m.id === p.materialId);
        if (!material) return null;
        const progress = computePlanProgress(p, material, noteEntries);
        return { plan: p, material, progress, overdue: daysUntilEnd(p) < 0 };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [plans, materials, noteEntries]);

  // きょう決めたこと (Phase B): pick → 表示行。完了は導出 (B-4: 宿題 status /
  // レジュメ understood)。完了行も当日は ✓ で見せる (翌日 fetch 掃除で消える)。
  const dayPickRows = useMemo(() => {
    return dayPicks
      .map((pick) => {
        const material = materials.find((m) => m.id === pick.materialId);
        if (!material || material.deletedAt) return null;
        if (pick.segmentId) {
          const seg = material.conceptSegments?.find(
            (s) => s.id === pick.segmentId,
          );
          if (!seg) return null;
          const done = noteEntries.some(
            (n) =>
              !n.deletedAt &&
              n.status === "understood" &&
              n.sourceMaterialId === material.id &&
              n.sourceSegmentId === pick.segmentId,
          );
          return {
            pick,
            material,
            kind: "segment" as const,
            title: seg.conceptName,
            detail: `${material.name}・p.${seg.startPdfPage}–${seg.endPdfPage}`,
            page: seg.startPdfPage,
            done,
          };
        }
        const done = (material.assignmentStatus ?? "todo") === "done";
        return {
          pick,
          material,
          kind: "assignment" as const,
          isTest: material.assignmentType === "test",
          title: material.name,
          dueDate: material.dueDate,
          done,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [dayPicks, materials, noteEntries]);

  // レジュメの手応え (北極星)
  const resumeStats = useMemo(() => {
    const active = noteEntries.filter((n) => !n.deletedAt);
    return {
      understood: active.filter((n) => n.status === "understood").length,
      needReview: active.filter((n) => n.status === "open").length,
    };
  }, [noteEntries]);

  // 📌 課題: open な Issue の上位 5 件
  const openIssues = useMemo(() => {
    return issues
      .filter((i) => i.status === "open")
      .slice(0, 5)
      .map((i) => ({
        issue: i,
        nodeName: nodes.find((n) => n.id === i.nodeId)?.name ?? null,
      }));
  }, [issues, nodes]);
  const openIssueCount = issues.filter((i) => i.status === "open").length;

  // 📚 教材: 本棚サムネ (先頭 8 冊、本のみ)
  const shelfMaterials = useMemo(
    () => materials.filter((m) => (m.kind ?? "book") === "book").slice(0, 8),
    [materials],
  );

  // 📝 宿題・テスト: 「まだ」を提出日が近い順に上位 5 件
  const todoAssignments = useMemo(() => {
    const list = materials.filter(
      (m) =>
        m.kind === "assignment" && (m.assignmentStatus ?? "todo") === "todo",
    );
    return [...list]
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      })
      .slice(0, 5);
  }, [materials]);
  const todoAssignmentCount = materials.filter(
    (m) =>
      m.kind === "assignment" && (m.assignmentStatus ?? "todo") === "todo",
  ).length;

  // 📅 宿題・テストの提出日 → 予定カレンダー自動マーカー (2026-06-11)。
  // 「まだ」のものだけ (やったら消える)。教材側が真実の情報源、カレンダーに行は作らない。
  const assignmentMarkers = useMemo(
    () =>
      materials
        .filter(
          (m) =>
            m.kind === "assignment" &&
            (m.assignmentStatus ?? "todo") === "todo" &&
            !m.deletedAt &&
            !!m.dueDate,
        )
        .map((m) => ({
          id: m.id,
          name: m.name,
          dueDate: m.dueDate!,
          isTest: m.assignmentType === "test",
        })),
    [materials],
  );

  const activePlanCount = planTasks.length;
  const overduePlanCount = planTasks.filter((t) => t.overdue).length;

  return (
    <div className="h-full w-full overflow-y-auto bg-canvas">
      {/* 全ブロックを同じ中央寄せ幅 (max-w-5xl) に収めて左右・余白を揃える */}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
        {/* 🔄 今日のタスク = 上段: 各プランの先頭まとまり (自動枠) + 下段: きょう決めたこと (Phase B) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListTodo className="size-4 text-primary" />
              <span>今日のタスク</span>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onStartDayRitual}
              className="h-7 gap-1.5 px-2 text-xs"
              title="ゆいと「今日なにやる?」を決める (左の chat に出るよ)"
            >
              <Sparkles className="size-3.5 text-amber-500" />
              <span>＋ゆいと決める</span>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {planTasks.length === 0 && dayPickRows.length === 0 ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-muted-foreground">
                  プランに教材を組み込むと、ここに「つぎにやるまとまり」が出てくるよ。「＋ゆいと決める」で今日やる宿題を選ぶこともできるよ。
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("materials")}
                  className="gap-1.5"
                >
                  <BookText className="size-3.5" />
                  <span>教材を見る</span>
                </Button>
              </div>
            ) : planTasks.length === 0 ? null : (
              <ul className="flex flex-col gap-1.5">
                {planTasks.map(({ plan, material, progress, overdue }) => (
                  <li
                    key={plan.id}
                    className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <span className="inline-flex w-14 shrink-0 items-center justify-center truncate rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground">
                      {subjectName(plan.subjectId) || "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      {progress.head ? (
                        <>
                          <div className="truncate text-sm font-medium text-foreground">
                            {progress.head.conceptName}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {material.name}・p.{progress.head.startPdfPage}–
                            {progress.head.endPdfPage}
                          </div>
                        </>
                      ) : (
                        <div className="truncate text-sm text-emerald-700 dark:text-emerald-300">
                          全まとまり済み！🎉（{material.name}）
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {progress.doneCount}/{progress.total}
                    </span>
                    {overdue && (
                      <button
                        type="button"
                        onClick={() => onNavigate("plans")}
                        className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 transition-colors hover:bg-violet-500/25 dark:text-violet-300"
                        title="チェックポイントが来たよ。プランで選ぼう"
                      >
                        チェックポイント
                      </button>
                    )}
                    {progress.head && (
                      <Button
                        size="sm"
                        onClick={() =>
                          onNavigate("material-read", {
                            materialId: material.id,
                            page: progress.head!.startPdfPage,
                            unit: true,
                          })
                        }
                        className="h-7 shrink-0 gap-1 px-2 text-xs"
                        title="このまとまりを葵先生と読む"
                      >
                        <BookOpen className="size-3.5" />
                        <span>学習する</span>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* 下段: きょう決めたこと (Phase B grill B-7。0 件の日は出さない = 実データだけ) */}
            {dayPickRows.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Sparkles className="size-3 text-amber-500" />
                  <span>きょう決めたこと</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {dayPickRows.map((row) => (
                    <li
                      key={row.pick.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md border px-3 py-2",
                        row.done
                          ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
                          : "border-border bg-card",
                      )}
                    >
                      <span className="inline-flex w-14 shrink-0 items-center justify-center truncate rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground">
                        {subjectName(row.material.subjectId) || "—"}
                      </span>
                      {row.kind === "assignment" && (
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                            row.isTest
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                          )}
                        >
                          {row.isTest ? (
                            <GraduationCap className="size-3" />
                          ) : (
                            <ClipboardList className="size-3" />
                          )}
                          {row.isTest ? "テスト" : "宿題"}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "truncate text-sm font-medium",
                            row.done
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-foreground",
                          )}
                        >
                          {row.done && (
                            <Check
                              className="mr-1 inline size-3.5"
                              strokeWidth={3}
                            />
                          )}
                          {row.title}
                        </div>
                        {row.kind === "segment" && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {row.detail}
                          </div>
                        )}
                      </div>
                      {row.kind === "assignment" && row.dueDate && !row.done && (
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {row.dueDate.slice(5).replace("-", "/")}まで
                        </span>
                      )}
                      {!row.done && (
                        <>
                          {row.kind === "segment" ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                onNavigate("material-read", {
                                  materialId: row.material.id,
                                  page: row.page,
                                  unit: true,
                                })
                              }
                              className="h-7 shrink-0 gap-1 px-2 text-xs"
                              title="このまとまりを葵先生と読む"
                            >
                              <BookOpen className="size-3.5" />
                              <span>学習する</span>
                            </Button>
                          ) : (
                            <>
                              {row.material.pdfPath && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    onNavigate("material-read", {
                                      materialId: row.material.id,
                                    })
                                  }
                                  className="h-7 shrink-0 gap-1 px-2 text-xs"
                                  title="葵先生と 1 問ずつ解説しながら解く"
                                >
                                  <BookOpen className="size-3.5" />
                                  <span>AI と解く</span>
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  onToggleAssignmentStatus(
                                    row.material.id,
                                    "done",
                                  )
                                }
                                className="h-7 shrink-0 gap-1 px-2 text-xs"
                                title="やったことにする"
                              >
                                <Check className="size-3.5" />
                                <span>やった</span>
                              </Button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => onRemoveDayPick(row.pick.id)}
                            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="今日はやめとく (リストから外すだけ)"
                          >
                            <X className="size-3.5" />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 📝 宿題・テスト (まだ の上位 5 + すべて見る→教材の宿題・テストタブ) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardList className="size-4 text-emerald-600" />
              <span>宿題・テスト</span>
              {todoAssignmentCount > 0 && (
                <span className="rounded-full bg-emerald-100 px-1.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  まだ {todoAssignmentCount}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onAddAssignmentQuick}
                className="h-7 gap-1 px-2 text-xs"
                title="宿題・テストをその場で登録"
              >
                <Plus className="size-3.5" />
                <span>追加</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate("materials", { tab: "assignments" })}
                className="h-auto gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <span>すべて見る</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {todoAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                まだやる宿題・テストはありません。
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {todoAssignments.map((a) => {
                  const isTest = a.assignmentType === "test";
                  const dl = a.dueDate != null ? daysUntil(a.dueDate) : null;
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <span className="inline-flex w-14 shrink-0 items-center justify-center truncate rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground">
                        {subjectName(a.subjectId) || "—"}
                      </span>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                          isTest
                            ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                        )}
                      >
                        {isTest ? (
                          <GraduationCap className="size-3" />
                        ) : (
                          <ClipboardList className="size-3" />
                        )}
                        {isTest ? "テスト" : "宿題"}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-foreground">
                        <span className="truncate">{a.name}</span>
                        {a.pdfPath && (
                          <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                        )}
                      </span>
                      {a.dueDate && (
                        <span
                          className={cn(
                            "shrink-0 text-[11px] tabular-nums",
                            dl !== null && dl <= 2
                              ? "font-semibold text-orange-600 dark:text-orange-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {a.dueDate.slice(5).replace("-", "/")}
                          {dl !== null && dl >= 0 && (
                            <span className="ml-1">
                              {dl === 0 ? "今日" : `あと${dl}日`}
                            </span>
                          )}
                        </span>
                      )}
                      {a.pdfPath && (
                        <Button
                          size="sm"
                          onClick={() =>
                            onNavigate("material-read", { materialId: a.id })
                          }
                          className="h-7 shrink-0 gap-1 px-2 text-xs"
                          title="葵先生と 1 問ずつ解説しながら解く"
                        >
                          <BookOpen className="size-3.5" />
                          <span>AI と解く</span>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 予定 (手動イベント + 宿題・テスト提出日の自動マーカー。リスト/カレンダー トグル) */}
        <SchedulePanel calendar={calendar} assignments={assignmentMarkers} />

        {/* 📌 課題セクション (open 上位 5 + すべて見る→issues) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="size-4 text-orange-600" />
              <span>課題</span>
              {openIssueCount > 0 && (
                <span className="rounded-full bg-orange-100 px-1.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                  {openIssueCount}
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("issues")}
              className="h-auto gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>すべて見る</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {openIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                未クリアの課題はありません。
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {openIssues.map(({ issue, nodeName }) => (
                  <li key={issue.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate("issue", { issueId: issue.id })}
                      className="flex w-full items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">
                          {issue.title}
                        </div>
                        {nodeName && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {nodeName}
                          </div>
                        )}
                      </div>
                      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 📚 教材セクション (本棚サムネ + すべて見る→materials) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookText className="size-4 text-primary" />
              <span>教材</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("materials")}
              className="h-auto gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>すべて見る</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {shelfMaterials.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {/* loading / error / 本当の 0 件 を区別 (2026-06-12 レビュー指摘) */}
                {materialsLoadState === "loading"
                  ? "教材を読み込んでいるよ…"
                  : materialsLoadState === "error"
                    ? "教材がうまく読み込めなかった…ページを再読み込みしてみてね。"
                    : "まだ教材が登録されていません。"}
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {shelfMaterials.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      onNavigate("material-detail", { materialId: m.id })
                    }
                    className="group flex w-[84px] shrink-0 flex-col gap-1.5 text-left"
                    title={m.name}
                  >
                    {m.coverThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.coverThumb}
                        alt=""
                        className="aspect-[3/4] w-full rounded-md border border-border bg-muted object-cover shadow-sm transition-transform group-hover:-translate-y-0.5"
                      />
                    ) : (
                      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-md border border-border bg-muted shadow-sm transition-transform group-hover:-translate-y-0.5">
                        <Book className="size-6 text-muted-foreground/50" />
                      </div>
                    )}
                    <span className="line-clamp-2 text-[11px] leading-tight text-foreground">
                      {m.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 📒 レジュメ (北極星)。プランと同じ横型 */}
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <NotebookPen className="size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">レジュメ</div>
              <div className="truncate text-[11px] text-muted-foreground">
                理解済み {resumeStats.understood}
                {resumeStats.needReview > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {" "}
                    ・振り返りが必要 {resumeStats.needReview} 件
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("notes")}
              className="shrink-0 gap-1.5"
            >
              <span>レジュメを見る</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* 🧭 プラン (実データのサマリー: 各プランの進捗バー + 期限) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Compass className="size-4 text-primary" />
              <span>プラン</span>
              {activePlanCount > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  進行中 {activePlanCount} 件
                </span>
              )}
              {overduePlanCount > 0 && (
                <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                  チェックポイント {overduePlanCount}
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("plans")}
              className="h-auto gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>すべて見る</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {planTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                教材を組み込むと、まとまりが順番に出てくるよ。
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {planTasks.map(({ plan, material, progress, overdue }) => {
                  const pct =
                    progress.total > 0
                      ? Math.round((progress.doneCount / progress.total) * 100)
                      : 0;
                  const days = daysUntilEnd(plan);
                  const allDone =
                    progress.total > 0 &&
                    progress.doneCount === progress.total;
                  return (
                    <li key={plan.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate("plans")}
                        className="flex w-full items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5"
                        title="プランを見る"
                      >
                        <span className="inline-flex w-14 shrink-0 items-center justify-center truncate rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground">
                          {subjectName(plan.subjectId) || "—"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {material.name}
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              {progress.doneCount}/{progress.total}・{pct}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full transition-all",
                                allDone ? "bg-emerald-500" : "bg-primary",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {overdue ? (
                            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 font-bold text-violet-700 dark:text-violet-300">
                              チェックポイント
                            </span>
                          ) : (
                            <>あと {days} 日</>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 📓 これまでの記録 (控えめな帯) */}
        <div className="mt-1 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
          <div className="mb-2 text-[11px] font-medium text-muted-foreground">
            これまでの記録
          </div>
          <div className="flex flex-wrap gap-2">
            <RecordLink
              icon={<MessageSquare className="size-3.5" />}
              label="対話の履歴"
              onClick={() => onNavigate("tutor-archive")}
            />
            <RecordLink
              icon={<History className="size-3.5" />}
              label="学習の履歴"
              onClick={() => onNavigate("history")}
            />
            <RecordLink
              icon={<RotateCcw className="size-3.5" />}
              label="振り返りログ"
              onClick={() => onNavigate("reflections")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordLink({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
