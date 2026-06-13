"use client";

/**
 * MaterialDetailView - 教材詳細ページ。
 *
 * 2026-06-08 ito19 さん意見で再構成。教材は「読むための源」と位置づけ、4 カード構成:
 * - メタ: 教材名 / 出版社 / 著者 + 編集 + 「一緒に読む」(最上部に集約)
 * - このテキストで設定されている課題 (Issue を coveredNodeIds 経由で逆引き、独立カード)
 * - 学習スケジュール組み込み状況
 * - まとまり一覧 (ConceptSegment、読書ビューと同じソース。「読む」で各単元へ)
 *
 * 撤去したもの (2026-06-08): 体系の地図 (マップ表示はレジュメ体系図へ集約) /
 * 評価コメントカード / 教材ごと葵 chat カード。
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubjectTeacherAvatar } from "@/components/ui/subject-teacher-avatar";
import { MaterialEditDialog } from "@/components/learn/MaterialEditDialog";
import {
  ArrowRight,
  BookOpen,
  BookText,
  CalendarClock,
  ChevronLeft,
  Compass,
  ListChecks,
  Loader2,
  Pencil,
  RotateCw,
} from "lucide-react";
import { isSegmentJobsEnabled } from "@/lib/materials/is-segment-jobs-enabled";
import { PlanAddDialog } from "@/components/plans/PlanAddDialog";
import {
  computePlanProgress,
  daysUntilEnd,
  getPlanSegments,
} from "@/lib/plans/plan-progress";
import type {
  Issue,
  KnowledgeNode,
  Material,
  NoteEntry,
  StudyPlan,
  Subject,
} from "@/lib/learn/types";

/**
 * 「学習内容でない区切り」(表紙・前付け・目次・使い方・奥付・索引など) かを名前で判定。
 * MaterialReadPane の同名ヘルパーと同じ判定 (まとまり一覧から前付けを除く)。
 */
function isFrontMatterName(name: string): boolean {
  return /表紙|扉|前付|まえがき|はじめに|序文|目次|もくじ|使い方|凡例|奥付|索引|さくいん|著者|広告|後付|あとがき/.test(
    name,
  );
}

type Props = {
  material: Material;
  subject: Subject | null;
  nodes: KnowledgeNode[];
  /** 全 Issue (課題)。この教材の coveredNodeIds に紐づく open 課題をメタ欄に表示する */
  issues: Issue[];
  /** 新プラン (2026-06-10): この教材のプラン状況表示 + 「プランに組み込む」 */
  plans: StudyPlan[];
  /** プラン進捗導出用 (レジュメが真実の情報源) */
  noteEntries: NoteEntry[];
  onCreatePlan: (material: Material, endsAt: string) => void;
  /** C46 F (ito19 さん意見): MaterialEditDialog の onSave 経由で呼ばれる */
  onMaterialUpdated: (id: string, patch: Partial<Material>) => void;
  /** C46 F (ito19 さん意見): MaterialEditDialog の onDelete 経由で呼ばれる */
  onMaterialDeleted: (id: string) => void;
  /** 「区切り直す」(2026-06-13): まとまり生成ジョブを再キュー (全状態可、古い単元は残す) */
  onResegment: (id: string) => void;
};

export function MaterialDetailView({
  material,
  subject,
  nodes,
  issues,
  plans,
  noteEntries,
  onCreatePlan,
  onMaterialUpdated,
  onMaterialDeleted,
  onResegment,
}: Props) {
  const router = useRouter();
  const segmentJobsEnabled = isSegmentJobsEnabled();
  // C46 F: 教材編集・削除 dialog の open state
  const [editOpen, setEditOpen] = useState(false);
  // 新プラン: 「プランに組み込む」ダイアログ
  const [planDialogOpen, setPlanDialogOpen] = useState(false);

  // この教材の「まとまり (一単元=1概念、ConceptSegment)」一覧。
  // 2026-06-08 ito19 さん意見「体系図(目次ノード)とまとまりは別物→まとまりに統一」。
  // 読書ビューの「まとまり一覧」と同じソース: 前付け等を除き、PDF 紙番号順に並べる。
  const contentSegments = useMemo(() => {
    const segs = material.conceptSegments ?? [];
    return segs
      .filter((s) => !isFrontMatterName(s.conceptName))
      .sort((a, b) => a.startPdfPage - b.startPdfPage);
  }, [material.conceptSegments]);

  // この教材に「現在設定されている課題」(open な Issue)。
  // Issue は KnowledgeNode (共有体系図) に紐づくので、教材の coveredNodeIds で逆引きする。
  // ノード名も添えて「どの論点の課題か」が分かるようにする。
  const materialIssues = useMemo(() => {
    const nodeIdSet = new Set(material.coveredNodeIds);
    return issues
      .filter((i) => i.status === "open" && nodeIdSet.has(i.nodeId))
      .map((i) => ({
        issue: i,
        nodeName: nodes.find((n) => n.id === i.nodeId)?.name ?? null,
      }));
  }, [issues, material.coveredNodeIds, nodes]);

  // 新プラン (2026-06-10): この教材のアクティブプランと進捗 (レジュメから導出)。
  // 旧 Phase 5 のモック集計 (MOCK_LEARNING_PLANS / GT / SI、信号機色) は廃止。
  const activePlan = useMemo(
    () =>
      plans.find(
        (p) =>
          p.materialId === material.id &&
          p.status === "active" &&
          !p.deletedAt,
      ) ?? null,
    [plans, material.id],
  );
  const planProgress = useMemo(
    () =>
      activePlan ? computePlanProgress(activePlan, material, noteEntries) : null,
    [activePlan, material, noteEntries],
  );
  const canAddToPlan = getPlanSegments(material).length > 0;

  return (
    // 二層パターン: flex 子の min-height: auto 規則で overflow が効かない問題を回避。
    // 外側 = h-full 固定 / 内側 = min-h-0 flex-1 overflow-y-auto で確実なスクロール領域。
    // 参考実装: WeeklyMonthlyReportView.tsx:102-104
    <div className="flex h-full w-full flex-col bg-canvas">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-5">
          {/* C53 ito19 さん意見「教材一覧に戻るボタンが欲しい」:
              教材詳細最上部にナビゲーション戻るリンクを配置。ゆいメニュー
              「教材」を何度も押さなくても 1 クリックで一覧に戻れる UX */}
          <div className="-mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/tutor?view=materials")}
              className="-ml-2 gap-1 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              <span>教材一覧に戻る</span>
            </Button>
          </div>

          {/* 教材メタ (2026-06-08 ito19 さん意見: メタ編集を最上部へ集約。
              教材名・出版社・著者 + この教材に設定されている課題 (Issue) を表示) */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          {/* タイトル行 + アクション */}
          <div className="flex items-start gap-3">
            {/* 2026-06-09 ito19 さん意見「ここも(本棚と同じ)表紙サムネを」:
                教材一覧 (本棚) と同じ cover_thumb を主役の表紙として出す。
                未生成 (= 一度も「一緒に読む」で開いていない) 教材は従来どおり
                担当先生アバター / BookText アイコンにフォールバック。 */}
            {material.coverThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={material.coverThumb}
                alt=""
                className="aspect-[3/4] w-24 shrink-0 rounded-md border border-border bg-muted object-cover shadow-sm"
              />
            ) : subject ? (
              <SubjectTeacherAvatar
                subjectId={subject.id}
                size={48}
                fallbackLetter={subject.teacher?.avatarLetter}
                className="shrink-0"
              />
            ) : (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
                <BookText className="size-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">{material.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{material.label}</Badge>
                <Badge variant="outline">{material.gradeLevel}</Badge>
                <span className="text-xs text-muted-foreground">
                  {subject?.teacher?.displayName ?? "担当先生未設定"} 担当
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* C46 F + 2026-06-08: メタ編集 / 削除をここ (最上部) に移動 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="gap-1.5"
              >
                <Pencil className="size-3.5" />
                <span>編集</span>
              </Button>
              {/* 段階1-C: PDF を一緒にめくって読む読書ビューへ */}
              <Button
                onClick={() =>
                  router.push(`/tutor?view=material-read&id=${material.id}`)
                }
                className="gap-1.5"
              >
                <BookText className="size-4" />
                <span>一緒に読む</span>
              </Button>
            </div>
          </div>

          {/* メタ情報: 出版社 / 著者 */}
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 border-t pt-3 text-sm sm:grid-cols-2">
            <div className="flex items-baseline gap-3">
              <span className="w-14 shrink-0 text-xs text-muted-foreground">
                出版社
              </span>
              <span
                className={cn(
                  material.publisher
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {material.publisher || "未設定"}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="w-14 shrink-0 text-xs text-muted-foreground">
                著者
              </span>
              <span
                className={cn(
                  material.author
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {material.author || "未設定"}
              </span>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* このテキストで設定されている課題 (Issue、ito19 さん意見、2026-06-08 独立カード化) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListChecks className="size-4 text-primary" />
            <span>このテキストで設定されている課題</span>
            {materialIssues.length > 0 && (
              <Badge variant="secondary" className="ml-0.5">
                {materialIssues.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {materialIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              この教材から立った課題はまだありません。
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                {materialIssues.slice(0, 5).map(({ issue, nodeName }) => (
                  <li
                    key={issue.id}
                    className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm"
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
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between">
                {materialIssues.length > 5 && (
                  <span className="text-[11px] text-muted-foreground">
                    …他 {materialIssues.length - 5} 件
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/tutor?view=issues")}
                  className="ml-auto h-auto gap-1 px-2 py-1 text-xs"
                >
                  <span>課題を見る</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 新プラン (2026-06-10): この教材のプラン状況。
          旧「学習スケジュール組み込み状況」(モック集計 + 信号機色) を置換。 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Compass className="size-4 text-primary" />
            <span>プラン</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {activePlan && planProgress ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">進み具合</span>
                <span className="text-foreground">
                  {planProgress.doneCount} / {planProgress.total} まとまり
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${
                      planProgress.total > 0
                        ? Math.round(
                            (planProgress.doneCount / planProgress.total) * 100,
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CalendarClock className="size-3" />
                {daysUntilEnd(activePlan) < 0 ? (
                  <span className="font-semibold text-violet-700 dark:text-violet-300">
                    チェックポイントが来たよ（プランで選ぼう）
                  </span>
                ) : (
                  <span>
                    {activePlan.endsAt.slice(5).replace("-", "/")} まで・あと{" "}
                    {daysUntilEnd(activePlan)} 日
                  </span>
                )}
              </div>
              {planProgress.head && (
                <div className="flex items-center gap-2.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                  <span className="shrink-0 text-[10px] font-semibold text-primary">
                    つぎ
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {planProgress.head.conceptName}
                  </span>
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/tutor?view=material-read&id=${material.id}&page=${planProgress.head!.startPdfPage}&unit=1`,
                      )
                    }
                    className="h-7 shrink-0 gap-1 px-2 text-xs"
                  >
                    <BookOpen className="size-3.5" />
                    <span>学習する</span>
                  </Button>
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/tutor?view=plans")}
                  className="gap-1.5"
                >
                  <span>プランを見る</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                この教材はまだプランに入っていません。組み込むと、まとまりが上から順に今日のタスクに出てくるよ。
              </p>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setPlanDialogOpen(true)}
                  disabled={!canAddToPlan}
                  className="gap-1.5"
                  title={
                    canAddToPlan
                      ? "期間を選ぶだけで組み込めるよ"
                      : "先に「一緒に読む」で開いて、まとまりを作ってね"
                  }
                >
                  <Compass className="size-3.5" />
                  <span>プランに組み込む</span>
                </Button>
              </div>
              {!canAddToPlan && (
                <p className="text-[11px] italic text-muted-foreground">
                  まだ「まとまり」が無いので組み込めません。先に「一緒に読む」で一度開いてね。
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/*
        まとまり一覧 (2026-06-08 ito19 さん意見「体系図(目次ノード)とまとまりは別物→まとまりに統一」):
        旧: 目次から抽出した体系図ノード (AiExtractedNode) を一覧していた。
        新: 葵が本文を読んで区切った「まとまり (ConceptSegment、1概念=1単元)」を一覧する。
        読書ビューの「まとまり一覧」と同じソース。各行から「読む」でその単元を一緒に読む。
        体系の地図 (マップ) はレジュメ体系図 (NotesHomeView) に集約済。
      */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookText className="size-4 text-primary" />
              <span>まとまり ({contentSegments.length} 個)</span>
              {(material.segmentStatus === "queued" ||
                material.segmentStatus === "processing") && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  <Loader2 className="size-3 animate-spin" />
                  準備中
                </span>
              )}
              {material.segmentStatus === "failed" && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                  区切れなかった
                </span>
              )}
            </CardTitle>
            {/* 区切り直す: ジョブ ON + PDF あり時のみ (全状態で再キュー、古い単元は残す) */}
            {segmentJobsEnabled && material.pdfPath && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResegment(material.id)}
                disabled={
                  material.segmentStatus === "queued" ||
                  material.segmentStatus === "processing"
                }
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                title="まとまりをもう一度作り直す"
              >
                <RotateCw className="size-3.5" />
                <span>区切り直す</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {contentSegments.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {material.segmentStatus === "queued" ||
                material.segmentStatus === "processing"
                  ? "葵先生がまとまり (一単元) に区切っているところだよ。少し待ってから開いてね。"
                  : material.segmentStatus === "failed"
                    ? "うまく区切れませんでした。「区切り直す」でもう一度試せます。「一緒に読む」で手めくり読書はできます。"
                    : "まだ「まとまり」が作られていません。教材を登録するとバックグラウンドで本文を読んで単元に区切ります。「一緒に読む」を開くと、その場でも作れます。"}
              </p>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/tutor?view=material-read&id=${material.id}`)
                  }
                  className="gap-1.5"
                >
                  <BookText className="size-4" />
                  <span>一緒に読む</span>
                </Button>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {contentSegments.map((seg) => (
                <li key={seg.id} className="flex items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/tutor?view=material-read&id=${material.id}&page=${seg.startPdfPage}&unit=1`,
                      )
                    }
                    className="group flex flex-1 items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
                    title={`「${seg.conceptName}」を一緒に読む`}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {seg.conceptName}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      p.{seg.startPdfPage}–{seg.endPdfPage}
                    </span>
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/tutor?view=material-read&id=${material.id}&page=${seg.startPdfPage}&unit=1`,
                      )
                    }
                    className="h-auto shrink-0 gap-1 px-2"
                    title="このまとまりを一緒に読む"
                  >
                    <BookText className="size-4" />
                    <span className="text-xs">読む</span>
                  </Button>
                </li>
              ))}
              <li className="mt-1 text-[11px] italic text-muted-foreground">
                📖 押すと、そのまとまりのページを開いて
                {subject?.teacher?.displayName ?? "葵先生"}と一緒に読めます
              </li>
            </ul>
          )}
        </CardContent>
      </Card>

      <MaterialEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        material={material}
        onSave={onMaterialUpdated}
        onDelete={onMaterialDeleted}
      />

      <PlanAddDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        material={material}
        onCreate={(endsAt) => onCreatePlan(material, endsAt)}
      />
        </div>
      </div>
    </div>
  );
}
