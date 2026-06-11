"use client";

/**
 * PlansView - 新プラン画面 (ザックリ・まとまりキュー型、2026-06-10 grill 確定)。
 * 旧 PlanEngineDashboard (Phase 5、予定表型) を丸ごと置き換え。
 *
 * - プランカード: 教材表紙 + 進捗 (済み/全まとまり、事実だけ・煽らない) + 期限 +
 *   先頭まとまり + 「学習する」
 * - 期限超過カードはチェックポイント表示 (延長 / ここで終了 / 最初からやり直す)。
 *   ブロックしない (先頭まとまりは出続ける)
 * - まとまり一覧を開くと ✅済み / ⏭スキップ / ⬜未 が見え、スキップをトグルできる
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Book,
  BookOpen,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Flag,
  RotateCcw,
  SkipForward,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computePlanProgress,
  daysUntilEnd,
} from "@/lib/plans/plan-progress";
import type {
  Material,
  NoteEntry,
  StudyPlan,
  Subject,
} from "@/lib/learn/types";

type Props = {
  plans: StudyPlan[];
  materials: Material[];
  subjects: Subject[];
  noteEntries: NoteEntry[];
  /** 先頭まとまりを学習する → 読書ビュー (page + unit 選択) */
  onStudy: (materialId: string, page: number) => void;
  /** チェックポイント: 延長する (期限変更) */
  onExtend: (planId: string, endsAt: string) => void;
  /** チェックポイント: ここで終了 (completed) */
  onComplete: (planId: string) => void;
  /** チェックポイント: 最初からやり直す (2周目 = 新プラン、countFrom=now) */
  onRestart: (plan: StudyPlan, endsAt: string) => void;
  /** まとまりのスキップ ⇔ 戻す */
  onToggleSkip: (planId: string, segmentId: string) => void;
  /** プランをやめる (論理削除。レジュメ・教材は残る) */
  onDelete: (planId: string) => void;
  /** 空状態から教材一覧へ */
  onOpenMaterials: () => void;
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonthsYmd(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return ymd(d);
}

export function PlansView({
  plans,
  materials,
  subjects,
  noteEntries,
  onStudy,
  onExtend,
  onComplete,
  onRestart,
  onToggleSkip,
  onDelete,
  onOpenMaterials,
}: Props) {
  const [showCompleted, setShowCompleted] = useState(false);

  const visible = useMemo(() => {
    const list = plans.filter((p) => !p.deletedAt);
    return showCompleted ? list : list.filter((p) => p.status === "active");
  }, [plans, showCompleted]);

  const completedCount = plans.filter(
    (p) => !p.deletedAt && p.status === "completed",
  ).length;

  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-5">
          <header className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Compass className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">プラン</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                教材を組み込むと、まとまりが上から順に今日のタスクに出てくるよ。終わらなくても大丈夫、自分のペースで。
              </p>
            </div>
            {completedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompleted((v) => !v)}
                className="h-7 text-xs text-muted-foreground"
              >
                {showCompleted ? "完了済を隠す" : `完了済を表示 (${completedCount})`}
              </Button>
            )}
          </header>

          {visible.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Compass className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  まだプランがないよ。教材の「プランに組み込む」から始めよう。
                </p>
                <Button variant="outline" size="sm" onClick={onOpenMaterials}>
                  教材を見る
                </Button>
              </CardContent>
            </Card>
          ) : (
            visible.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                material={materials.find((m) => m.id === plan.materialId) ?? null}
                subjectName={
                  subjects.find((s) => s.id === plan.subjectId)?.name ?? ""
                }
                noteEntries={noteEntries}
                onStudy={onStudy}
                onExtend={onExtend}
                onComplete={onComplete}
                onRestart={onRestart}
                onToggleSkip={onToggleSkip}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  material,
  subjectName,
  noteEntries,
  onStudy,
  onExtend,
  onComplete,
  onRestart,
  onToggleSkip,
  onDelete,
}: {
  plan: StudyPlan;
  material: Material | null;
  subjectName: string;
  noteEntries: NoteEntry[];
} & Pick<
  Props,
  "onStudy" | "onExtend" | "onComplete" | "onRestart" | "onToggleSkip" | "onDelete"
>) {
  const [listOpen, setListOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDate, setExtendDate] = useState(addMonthsYmd(1));
  const [restartDate, setRestartDate] = useState(addMonthsYmd(3));
  const [restartOpen, setRestartOpen] = useState(false);

  const progress = useMemo(
    () =>
      material ? computePlanProgress(plan, material, noteEntries) : null,
    [plan, material, noteEntries],
  );

  if (!material || !progress) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Book className="size-4" />
          <span>教材が見つかりませんでした（削除された可能性）。</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(plan.id)}
            className="ml-auto h-7 text-xs text-destructive hover:text-destructive"
          >
            プランを消す
          </Button>
        </CardContent>
      </Card>
    );
  }

  const days = daysUntilEnd(plan);
  const overdue = plan.status === "active" && days < 0;
  const completed = plan.status === "completed";
  const pct =
    progress.total > 0
      ? Math.round((progress.doneCount / progress.total) * 100)
      : 0;
  const allDone = progress.total > 0 && progress.doneCount === progress.total;

  return (
    <Card className={cn(completed && "opacity-70")}>
      <CardContent className="flex flex-col gap-3 py-4">
        {/* ヘッダ行: 表紙 + 名前 + 科目 + 期限 */}
        <div className="flex items-start gap-3">
          {material.coverThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={material.coverThumb}
              alt=""
              className="aspect-[3/4] w-12 shrink-0 rounded border border-border bg-muted object-cover shadow-sm"
            />
          ) : (
            <div className="flex aspect-[3/4] w-12 shrink-0 items-center justify-center rounded border border-border bg-muted">
              <Book className="size-5 text-muted-foreground/50" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {subjectName || "—"}
              </span>
              {completed && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Flag className="size-3" />
                  終了
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {material.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarClock className="size-3" />
              {completed ? (
                <span>おつかれさま</span>
              ) : overdue ? (
                <span className="font-semibold text-violet-700 dark:text-violet-300">
                  チェックポイントが来たよ（{plan.endsAt.slice(5).replace("-", "/")}）
                </span>
              ) : (
                <span>
                  {plan.endsAt.slice(5).replace("-", "/")} まで・あと {days} 日
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 進捗 (事実だけ) */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {progress.doneCount} / {progress.total} まとまり
            </span>
            <span className="tabular-nums">{pct}%</span>
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

        {/* チェックポイント 3 択 (期限超過 + active のみ) */}
        {overdue && (
          <div className="flex flex-col gap-2 rounded-md border border-violet-300/60 bg-violet-50/50 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
            <p className="text-xs text-foreground">
              ここまでで {progress.doneCount} / {progress.total} まとまり済んだよ。どうする？
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {!extendOpen ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExtendOpen(true)}
                  className="h-7 gap-1 text-xs"
                >
                  <CalendarClock className="size-3.5" />
                  延長する
                </Button>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    value={extendDate}
                    onChange={(e) => setExtendDate(e.target.value)}
                    className="h-7 w-auto text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      onExtend(plan.id, extendDate);
                      setExtendOpen(false);
                    }}
                    className="h-7 text-xs"
                  >
                    決定
                  </Button>
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onComplete(plan.id)}
                className="h-7 gap-1 text-xs"
              >
                <Flag className="size-3.5" />
                ここで終了
              </Button>
              {!restartOpen ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRestartOpen(true)}
                  className="h-7 gap-1 text-xs"
                  title="同じ教材で 2 周目を始める (レジュメは残る)"
                >
                  <RotateCcw className="size-3.5" />
                  最初からやり直す
                </Button>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    value={restartDate}
                    onChange={(e) => setRestartDate(e.target.value)}
                    className="h-7 w-auto text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      onRestart(plan, restartDate);
                      setRestartOpen(false);
                    }}
                    className="h-7 text-xs"
                  >
                    2周目開始
                  </Button>
                </span>
              )}
            </div>
          </div>
        )}

        {/* 先頭まとまり + 学習する */}
        {plan.status === "active" &&
          (progress.head ? (
            <div className="flex items-center gap-2.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
              <span className="shrink-0 text-[10px] font-semibold text-primary">
                つぎ
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {progress.head.conceptName}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                p.{progress.head.startPdfPage}–{progress.head.endPdfPage}
              </span>
              <Button
                size="sm"
                onClick={() => onStudy(material.id, progress.head!.startPdfPage)}
                className="h-7 shrink-0 gap-1 px-2 text-xs"
              >
                <BookOpen className="size-3.5" />
                学習する
              </Button>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-300/60 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              全部のまとまりが済んだよ！🎉 チェックポイントで「ここで終了」か「最初からやり直す (2周目)」を選ぼう。
            </div>
          ))}

        {/* まとまり一覧 (開閉) */}
        <div>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {listOpen ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            まとまり一覧 ({progress.total})
          </button>
          {listOpen && (
            <ul className="mt-2 flex flex-col gap-1">
              {progress.segments.map((seg) => {
                const state = progress.states.get(seg.id) ?? "pending";
                const isHead = progress.head?.id === seg.id;
                return (
                  <li
                    key={seg.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                      isHead
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-card",
                      state !== "pending" && "opacity-70",
                    )}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {state === "done" ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : state === "skipped" ? (
                        <SkipForward className="size-3.5 text-muted-foreground" />
                      ) : (
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            isHead ? "bg-primary" : "bg-muted-foreground/30",
                          )}
                        />
                      )}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        state === "done" && "line-through",
                      )}
                    >
                      {seg.conceptName}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      p.{seg.startPdfPage}–{seg.endPdfPage}
                    </span>
                    {state !== "done" && plan.status === "active" && (
                      <button
                        type="button"
                        onClick={() => onToggleSkip(plan.id, seg.id)}
                        className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                        title={
                          state === "skipped"
                            ? "スキップを取り消してやる"
                            : "このまとまりは飛ばす (レジュメは作られない)"
                        }
                      >
                        {state === "skipped" ? "やっぱりやる" : "スキップ"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* フッタ: プランをやめる */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (
                window.confirm(
                  `「${material.name}」のプランをやめますか？（レジュメや教材は消えません）`,
                )
              ) {
                onDelete(plan.id);
              }
            }}
            className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" />
            プランをやめる
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
