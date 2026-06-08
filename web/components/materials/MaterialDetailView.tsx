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
  BookText,
  CalendarClock,
  ChevronLeft,
  ListChecks,
  Pencil,
} from "lucide-react";
import {
  MOCK_GENERATED_TASKS,
  MOCK_LEARNING_PLANS,
  MOCK_SCHEDULE_TODAY,
  MOCK_SCHEDULE_UPCOMING,
} from "@/lib/learn/mock-data";
import type {
  Issue,
  KnowledgeNode,
  Material,
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
  /** C46 F (ito19 さん意見): MaterialEditDialog の onSave 経由で呼ばれる */
  onMaterialUpdated: (id: string, patch: Partial<Material>) => void;
  /** C46 F (ito19 さん意見): MaterialEditDialog の onDelete 経由で呼ばれる */
  onMaterialDeleted: (id: string) => void;
};

export function MaterialDetailView({
  material,
  subject,
  nodes,
  issues,
  onMaterialUpdated,
  onMaterialDeleted,
}: Props) {
  const router = useRouter();
  // C46 F: 教材編集・削除 dialog の open state
  const [editOpen, setEditOpen] = useState(false);

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

  // D + E 2026-05-26 (ito19 さん意見 α 案): スケジュール組み込み状況
  // - active LearningPlan を materialIds で逆引き
  // - SI → GT → resource.materialId の経路で「教材紐付き SI」を集計 (P5-Q1 構造)
  // - 当月の SI (SI.date が YYYY-MM- prefix 一致) + 進捗 % + 未着手 SI 上位 3 件
  //   + [今月の予定を見る] ボタン (today-tasks 遷移)
  // C49 2026-05-26 (ito19 さん意見): 信号機色 (赤/黄/青) で進捗状況を表示、
  //   パッと見で順調かどうかが分かるように。
  //   ⚠️ TODO: 暫定閾値 (80% 順調 / 50-80% 注意 / 50%未満 遅れ)。
  //   本物の閾値ロジック (日付経過率との比較: 月の半分過ぎてるのに 30%
  //   なら赤、等) は ito19 さん「要件は後で詰める」明示なので Phase 6/7
  //   の要件 grill で確定する。
  const scheduleInfo = useMemo(() => {
    const activePlan = MOCK_LEARNING_PLANS.find(
      (p) =>
        p.materialIds.includes(material.id) && p.status === "active",
    );
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const gtIdsForMaterial = new Set(
      MOCK_GENERATED_TASKS.filter(
        (gt) => gt.resource.materialId === material.id,
      ).map((gt) => gt.id),
    );
    const allSIs = [...MOCK_SCHEDULE_TODAY, ...MOCK_SCHEDULE_UPCOMING];
    const thisMonthSIs = allSIs.filter(
      (si) =>
        si.date.startsWith(thisMonth) &&
        si.generatedTaskId !== undefined &&
        gtIdsForMaterial.has(si.generatedTaskId),
    );
    const doneCount = thisMonthSIs.filter((si) => si.status === "done").length;
    const totalCount = thisMonthSIs.length;
    const progressPct =
      totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const unfinished = thisMonthSIs
      .filter((si) => si.status !== "done" && si.status !== "skipped")
      .slice(0, 3);
    // C49 暫定信号: Phase 6/7 で要件 grill 確定後に置換予定
    const signal: "green" | "yellow" | "red" | null =
      totalCount === 0
        ? null
        : progressPct >= 80
          ? "green"
          : progressPct >= 50
            ? "yellow"
            : "red";
    return {
      activePlan,
      thisMonthSIs,
      doneCount,
      totalCount,
      progressPct,
      unfinished,
      signal,
    };
  }, [material.id]);

  // C49 信号機色 → スタイル設定 (Phase 6/7 要件 grill 後に閾値/色を再確定)
  const signalConfig = scheduleInfo.signal
    ? {
        green: {
          label: "順調",
          dot: "bg-emerald-500",
          text: "text-emerald-700",
          bar: "bg-emerald-500",
          ring: "ring-emerald-200",
        },
        yellow: {
          label: "ペース注意",
          dot: "bg-amber-500",
          text: "text-amber-700",
          bar: "bg-amber-500",
          ring: "ring-amber-200",
        },
        red: {
          label: "遅れ気味",
          dot: "bg-red-500",
          text: "text-red-700",
          bar: "bg-red-500",
          ring: "ring-red-200",
        },
      }[scheduleInfo.signal]
    : null;

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
            {subject ? (
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

      {/* D + E 2026-05-26 (ito19 さん意見 α 案、C45): 学習スケジュール組み込み状況 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarClock className="size-4 text-primary" />
            <span>学習スケジュール組み込み状況</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {scheduleInfo.activePlan ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">計画</span>
                <span className="truncate font-medium text-foreground">
                  {scheduleInfo.activePlan.title}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">今月の予定</span>
                <span className="text-foreground">
                  {scheduleInfo.doneCount} / {scheduleInfo.totalCount} 件 完了 (
                  <span className="font-medium text-primary">
                    {scheduleInfo.progressPct}%
                  </span>
                  )
                </span>
              </div>
              {/* C49 進捗 信号機表示 (ito19 さん意見、暫定閾値、Phase 6/7 で要件 grill) */}
              {signalConfig && (
                <div
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 ring-1 ring-inset",
                    signalConfig.ring,
                  )}
                >
                  <span className="text-xs text-muted-foreground">進捗状況</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-sm font-medium",
                      signalConfig.text,
                    )}
                  >
                    <span
                      className={cn(
                        "size-2.5 rounded-full",
                        signalConfig.dot,
                      )}
                    />
                    {signalConfig.label}
                  </span>
                </div>
              )}
              {scheduleInfo.totalCount > 0 && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all",
                      signalConfig?.bar ?? "bg-primary",
                    )}
                    style={{ width: `${scheduleInfo.progressPct}%` }}
                  />
                </div>
              )}
              {scheduleInfo.unfinished.length > 0 && (
                <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-2">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    未着手 (上位 {scheduleInfo.unfinished.length} 件)
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {scheduleInfo.unfinished.map((si) => (
                      <li
                        key={si.id}
                        className="flex items-baseline justify-between gap-2 text-xs"
                      >
                        <span className="truncate text-foreground">
                          • {si.title}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {si.date} 予定
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* C51 ito19 さん意見: 「学習スケジュールに組み込まれていない場合は
                  予定の画面に遷移できなくていい」 → 今月の SI が 0 件 (= 計画には
                  紐付くが今月分は未展開 or 未生成) の時はボタン非表示、代わりに
                  「今月の予定はまだありません」テキストを出す */}
              {scheduleInfo.totalCount > 0 ? (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push("/tutor?view=today-tasks")}
                    className="gap-1.5"
                  >
                    <span>今月の予定を見る</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">
                  今月の予定はまだありません。
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                この教材はまだ学習計画に組み込まれていません。
              </p>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/tutor?view=plans")}
                  className="gap-1.5"
                >
                  <span>計画を立てる</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
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
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookText className="size-4 text-primary" />
            <span>まとまり ({contentSegments.length} 個)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contentSegments.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                まだ「まとまり」が作られていません。教材を登録するとバックグラウンドで本文を読んで単元に区切ります。「一緒に読む」を開くと、その場でも作れます。
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
        </div>
      </div>
    </div>
  );
}
