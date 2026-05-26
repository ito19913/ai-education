"use client";

/**
 * MaterialDetailView - 教材詳細ページ。
 *
 * 2026-05-25 grill 1 (教材アップロード設計) C32 ガワ実装。
 *
 * - 確定 5: 教材アップ後の動線は計画と疎結合 → 教材詳細ページで体系図/評価/葵 chat 完結
 * - 確定 11: 葵の教材出力 = 体系図 (テキスト忠実) + 評価コメント (葵の見解) 2 レイヤ
 * - 確定 12: 教材ごとに葵 chat 独立スレッド (本ページに集約)
 * - 確定 13: アップ完了動線 = ゆいから「葵が読んだよ、見る?」→ 本ページ展開
 *
 * 現状はガワのみ:
 * - 体系図プレビューは coveredNodeIds → KnowledgeNode のシンプルリスト
 * - 評価コメントは葵生成 mock テキスト (Phase 6 で Claude Opus 出力に置換)
 * - 葵 chat 入力欄は placeholder 表示のみ (Phase 6 で本物の chat スレッド実装)
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SubjectTeacherAvatar } from "@/components/ui/subject-teacher-avatar";
import { MindMapPane } from "@/components/learn/MindMapPane";
import { MaterialEditDialog } from "@/components/learn/MaterialEditDialog";
import {
  ArrowRight,
  BookText,
  CalendarClock,
  MessageCircle,
  Pencil,
  Send,
  Sparkles,
} from "lucide-react";
import {
  MOCK_GENERATED_TASKS,
  MOCK_LEARNING_PLANS,
  MOCK_SCHEDULE_TODAY,
  MOCK_SCHEDULE_UPCOMING,
} from "@/lib/learn/mock-data";
import type { KnowledgeNode, Material, Subject } from "@/lib/learn/types";

type Props = {
  material: Material;
  subject: Subject | null;
  nodes: KnowledgeNode[];
  /** C46 F (ito19 さん意見): MaterialEditDialog の onSave 経由で呼ばれる */
  onMaterialUpdated: (id: string, patch: Partial<Material>) => void;
  /** C46 F (ito19 さん意見): MaterialEditDialog の onDelete 経由で呼ばれる */
  onMaterialDeleted: (id: string) => void;
};

export function MaterialDetailView({
  material,
  subject,
  nodes,
  onMaterialUpdated,
  onMaterialDeleted,
}: Props) {
  const router = useRouter();
  // C46 F: 教材編集・削除 dialog の open state
  const [editOpen, setEditOpen] = useState(false);
  // C48 2026-05-26 (ito19 さん意見): 体系図 リスト ⇄ マップ 切替モード
  // default = "list" (テキスト忠実、grill 1 確定 10 整合)、マップは MindMapPane 表示
  const [systemMapMode, setSystemMapMode] = useState<"list" | "map">("list");

  const coveredNodes = material.coveredNodeIds
    .map((nodeId) => nodes.find((n) => n.id === nodeId))
    .filter((n): n is KnowledgeNode => n !== undefined);

  // D + E 2026-05-26 (ito19 さん意見 α 案): スケジュール組み込み状況
  // - active LearningPlan を materialIds で逆引き
  // - SI → GT → resource.materialId の経路で「教材紐付き SI」を集計 (P5-Q1 構造)
  // - 当月の SI (SI.date が YYYY-MM- prefix 一致) + 進捗 % + 未着手 SI 上位 3 件
  //   + [今月の予定を見る] ボタン (today-tasks 遷移)
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
    return { activePlan, thisMonthSIs, doneCount, totalCount, progressPct, unfinished };
  }, [material.id]);

  // 評価コメント mock (Phase 6 で葵先生 Claude Opus の本物出力に置換)
  const aoiReview = {
    coverage: `${material.name} は、${subject?.name ?? "この教科"}の${material.gradeLevel} 範囲を網羅していて、体系の骨格を掴むのに使えそう。`,
    difficulty: "難易度は標準的。基礎の解説が丁寧で、演習問題も着実にこなせる量。",
    fit: "今の学習段階にちょうど合っていると思う。最初の通読は焦らず、まずは骨格を掴むことを優先しよう。",
    notes: [
      "演習問題を解く時は、答えを見る前に必ず「自分の言葉で説明」してみよう。",
      "わからない用語に出会ったら、その場で「どうしてこの言葉が出てきたのか」を考えよう。",
      "1 回転目は完璧を目指さず、全体像を掴むことに集中。2 回転目から細部に入ろう。",
    ],
  };

  return (
    // 二層パターン: flex 子の min-height: auto 規則で overflow が効かない問題を回避。
    // 外側 = h-full 固定 / 内側 = min-h-0 flex-1 overflow-y-auto で確実なスクロール領域。
    // 参考実装: WeeklyMonthlyReportView.tsx:102-104
    <div className="flex h-full w-full flex-col bg-canvas">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-5">
          {/* 教材メタ */}
      <Card>
        <CardContent className="flex items-start gap-3 pt-5">
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
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{material.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">{material.label}</Badge>
              <Badge variant="outline">{material.gradeLevel}</Badge>
              <span className="text-xs text-muted-foreground">
                {subject?.teacher?.displayName ?? "担当先生未設定"} 担当
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 葵の評価コメント (確定 11) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-amber-500" />
            <span>{subject?.teacher?.displayName ?? "葵先生"}が読んでみての評価</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">範囲</div>
            <p className="text-foreground">{aoiReview.coverage}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">難易度</div>
            <p className="text-foreground">{aoiReview.difficulty}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">あなたへのフィット</div>
            <p className="text-foreground">{aoiReview.fit}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">使い方のヒント</div>
            <ul className="ml-4 list-disc space-y-1 text-foreground">
              {aoiReview.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] italic text-muted-foreground">
            ※ 現状は mock 表示。Phase 6 で本物の {subject?.teacher?.displayName ?? "葵先生"}{" "}
            (Claude Opus) が教材を読んで体系図 + 評価コメントを生成します。
          </p>
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
              {scheduleInfo.totalCount > 0 && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
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
        体系図 (リスト ⇄ マップ 切替、C48 ito19 さん意見):
        旧 (C43): 体系図フローチャート Card (MindMapPane) と 体系図ノードリスト Card の
        2 枚を縦に並べて両方表示していた → 縦に冗長 + マップ常時表示で重い
        新 (C48): 1 Card に統合、ヘッダー右側のトグル (リスト / マップ) で切替
        デフォルト = リスト (確定 10 テキスト忠実、軽量、最初のスキャン用途)
        マップ = MindMapPane (React Flow 階層図、グラフ的理解用途)
      */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <BookText className="size-4 text-primary" />
              <span>体系図 ({coveredNodes.length} ノード)</span>
            </div>
            <div className="flex items-center gap-0 rounded-md border border-border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSystemMapMode("list")}
                className={cn(
                  "rounded px-2 py-0.5 transition-colors",
                  systemMapMode === "list"
                    ? "bg-card font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                リスト
              </button>
              <button
                type="button"
                onClick={() => setSystemMapMode("map")}
                className={cn(
                  "rounded px-2 py-0.5 transition-colors",
                  systemMapMode === "map"
                    ? "bg-card font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                マップ
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className={systemMapMode === "map" ? "h-[420px] p-0" : ""}>
          {systemMapMode === "map" ? (
            // currentNodeId は教材詳細で「今ここ」概念が無いため coveredNodes[0]?.id を仮指定
            // (ハイライト用、ノードクリックは no-op、将来「ノードごと chat」入口にできる)
            <MindMapPane
              nodes={coveredNodes}
              currentNodeId={coveredNodes[0]?.id ?? ""}
              onSelectNode={() => {}}
              viewTitle={material.name}
              visibleNodeCount={coveredNodes.length}
            />
          ) : coveredNodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              この教材にはまだノードが紐付いていません。
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {coveredNodes.slice(0, 20).map((node) => (
                <li
                  key={node.id}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <div className="font-medium">{node.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {node.description}
                  </div>
                </li>
              ))}
              {coveredNodes.length > 20 && (
                <li className="text-xs text-muted-foreground">
                  …他 {coveredNodes.length - 20} 件
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 葵 chat 入力欄 (確定 12: 教材ごと独立スレッド、Phase 6 で本実装) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="size-4 text-primary" />
            <span>{subject?.teacher?.displayName ?? "葵先生"}にこの教材について聞く</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Textarea
            placeholder={`例: 「この教材の第3章ってどんな内容?」「この問題集と前の教科書の違いは?」`}
            rows={3}
            disabled
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] italic text-muted-foreground">
              ※ 現状は placeholder 表示。Phase 6 で教材ごと独立 chat スレッドを実装します。
            </p>
            <Button size="sm" disabled className="gap-1.5">
              <Send className="size-3.5" />
              <span>送信</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 教材の管理 (C46 F、ito19 さん意見): 編集 + 削除 dialog の起点
          誤操作防止のため削除は dialog 内に置く (MaterialEditDialog の設計を踏襲) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Pencil className="size-4 text-muted-foreground" />
            <span>教材の管理</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-1.5"
          >
            <Pencil className="size-3.5" />
            <span>メタ情報を編集 / 削除</span>
          </Button>
          <p className="mt-2 text-[11px] italic text-muted-foreground">
            ※ 編集できるのは名前・種別・学年。PDF 差し替えは新規登録扱い (体系図が変わるため)。
            削除は編集ダイアログ内の「ゴミ箱」から (誤操作防止)。
          </p>
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
