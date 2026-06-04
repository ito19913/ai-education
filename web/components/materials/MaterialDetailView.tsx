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
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  generateMaterialReviewViaClaude,
  type MaterialReviewOutput,
} from "@/lib/admin/review-claude";
import {
  respondViaAokiChat,
  type AokiChatMessage,
} from "@/lib/admin/aoki-chat-claude";
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
  ChevronLeft,
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

/**
 * 体系図リスト/マップ表示に使うノード型。
 * 段階1-A: 教材固有体系図 (extractedNodes) はページ範囲を持つので KnowledgeNode を拡張。
 */
type DisplayNode = KnowledgeNode & {
  /** 例 "p.42-58"。共有 MOCK_TREE 由来のノードは持たない */
  pageRange?: string;
};

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
  // C52 2026-05-26 (ito19 さん意見「ノードリスト → 葵 chat 遷移」):
  // ノードクリックで「そのノードについて葵に聞く」focus + chat エリアに scroll
  // ガワ実装: 選択ノードを placeholder / ヘッダに反映、本物 thread 設計は Phase 6
  // (grill 1 確定 12「教材ごと独立 chat スレッド」を「ノードごと thread」 or
  //  「教材 thread 内のノードフォーカス」のどちらにするかは Phase 6 grill)
  const [selectedChatNode, setSelectedChatNode] = useState<KnowledgeNode | null>(
    null,
  );
  const chatCardRef = useRef<HTMLDivElement>(null);
  const handleSelectNodeForChat = (node: KnowledgeNode) => {
    setSelectedChatNode(node);
    // ChatCard までスムーズスクロール
    requestAnimationFrame(() => {
      chatCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  // 段階1-A: 教材固有の体系図 (extractedNodes、目次から抽出した実単元 + ページ範囲) が
  // あればそれを表示。なければ従来の共有 MOCK_TREE (coveredNodeIds) を表示 (後方互換)。
  const coveredNodes = useMemo<DisplayNode[]>(() => {
    if (material.extractedNodes && material.extractedNodes.length > 0) {
      return material.extractedNodes.map((n) => ({
        id: n.tempId,
        name: n.name,
        parentId: n.parentRef,
        description: n.description,
        pageRange: n.pageRange,
      }));
    }
    return material.coveredNodeIds
      .map((nodeId) => nodes.find((n) => n.id === nodeId))
      .filter((n): n is KnowledgeNode => n !== undefined);
  }, [material.extractedNodes, material.coveredNodeIds, nodes]);

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

  // 評価コメント (B3 2026-06-04): NEXT_PUBLIC_USE_CLAUDE_API=true なら Claude
  // Opus 4.8 が葵先生として生成、失敗時 / flag off は下記 mock fallback。
  // 教材切替 (material.id 変化) ごとに再フェッチする。Phase 7 永続化時に
  // MaterialReview を DB 保存して 1 回だけ呼ぶ設計に切替予定。
  const mockReview = useMemo<MaterialReviewOutput>(
    () => ({
      coverage: `${material.name} は、${subject?.name ?? "この教科"}の${material.gradeLevel} 範囲を網羅していて、体系の骨格を掴むのに使えそう。`,
      difficulty:
        "難易度は標準的。基礎の解説が丁寧で、演習問題も着実にこなせる量。",
      fit: "今の学習段階にちょうど合っていると思う。最初の通読は焦らず、まずは骨格を掴むことを優先しよう。",
      notes: [
        "演習問題を解く時は、答えを見る前に必ず「自分の言葉で説明」してみよう。",
        "わからない用語に出会ったら、その場で「どうしてこの言葉が出てきたのか」を考えよう。",
        "1 回転目は完璧を目指さず、全体像を掴むことに集中。2 回転目から細部に入ろう。",
      ],
    }),
    [material.name, material.gradeLevel, subject?.name],
  );
  const [aoiReview, setAoiReview] = useState<MaterialReviewOutput>(mockReview);

  // B1 葵 chat (C75 2026-06-04 本実装): 教材ごと in-memory スレッド
  const [aokiChatHistory, setAokiChatHistory] = useState<AokiChatMessage[]>([]);
  const [aokiChatDraft, setAokiChatDraft] = useState("");
  const [aokiChatSending, setAokiChatSending] = useState(false);

  // 教材切替時に chat をクリア (= 別教材は別スレッド、確定 12)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAokiChatHistory([]);
    setAokiChatDraft("");
  }, [material.id]);

  const handleAokiChatSend = async () => {
    const userMessage = aokiChatDraft.trim();
    if (userMessage.length === 0 || aokiChatSending) return;
    setAokiChatSending(true);
    const newUserMsg: AokiChatMessage = { role: "user", text: userMessage };
    const newHistory = [...aokiChatHistory, newUserMsg];
    setAokiChatHistory(newHistory);
    setAokiChatDraft("");
    try {
      const aiText = await respondViaAokiChat({
        materialName: material.name,
        subjectName: subject?.name ?? "教科",
        gradeLevel: material.gradeLevel ?? "中2",
        focusNodeName: selectedChatNode?.name ?? null,
        history: aokiChatHistory,
        userMessage,
      });
      setAokiChatHistory([...newHistory, { role: "assistant", text: aiText }]);
    } catch (err) {
      console.error("[B1] aoki-chat failed:", err);
      setAokiChatHistory([
        ...newHistory,
        {
          role: "assistant",
          text: "ごめん、ちょっと今うまく考えがまとまらない…もう一度送ってもらえる?",
        },
      ]);
    } finally {
      setAokiChatSending(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAoiReview(mockReview);
    const useClaude = process.env.NEXT_PUBLIC_USE_CLAUDE_API === "true";
    if (!useClaude) return;
    let cancelled = false;
    generateMaterialReviewViaClaude({
      materialName: material.name,
      subjectName: subject?.name ?? "教科",
      gradeLevel: material.gradeLevel ?? "中2",
      label: material.label,
    })
      .then((res) => {
        if (!cancelled) setAoiReview(res);
      })
      .catch((err) => {
        console.error("[B3] review-claude failed, mock 維持:", err);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.id]);

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
        <CardContent className={systemMapMode === "map" ? "h-[700px] p-0" : ""}>
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
            // C52: ノードリスト = 葵 chat 入口一覧。各行 button 化 + クリックで
            // 「そのノードについて葵に聞く」chat エリアに scroll + 選択 state 保持。
            // hover で border-primary + 右側 MessageCircle icon (chat 連想)
            <ul className="flex flex-col gap-1">
              {coveredNodes.slice(0, 20).map((node) => {
                const isSelected = selectedChatNode?.id === node.id;
                return (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectNodeForChat(node)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary hover:bg-primary/5",
                      )}
                      title={`「${node.name}」について ${subject?.teacher?.displayName ?? "葵先生"} に聞く`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium">{node.name}</span>
                          {node.pageRange && node.pageRange !== "p.?-?" && (
                            <span className="shrink-0 text-[11px] font-normal text-primary/70">
                              {node.pageRange}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {node.description}
                        </div>
                      </div>
                      <MessageCircle
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          isSelected
                            ? "text-primary"
                            : "text-muted-foreground/40 group-hover:text-primary",
                        )}
                      />
                    </button>
                  </li>
                );
              })}
              {coveredNodes.length > 20 && (
                <li className="text-xs text-muted-foreground">
                  …他 {coveredNodes.length - 20} 件
                </li>
              )}
              <li className="mt-1 text-[11px] italic text-muted-foreground">
                💬 ノードをクリックすると、そのノードについて
                {subject?.teacher?.displayName ?? "葵先生"} に聞ける chat に飛びます
              </li>
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 葵 chat 入力欄 (確定 12: 教材ごと独立スレッド、B1 C75 2026-06-04 本実装)
          - chat 履歴は本コンポーネント内 useState 管理 (in-memory、リロードで消える)
          - Phase 7 永続化で Supabase に保存予定 (教材ごとスレッド) */}
      <Card ref={chatCardRef}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-primary" />
              <span>
                {selectedChatNode ? (
                  <>
                    「<span className="text-primary">{selectedChatNode.name}</span>」について
                    {subject?.teacher?.displayName ?? "葵先生"}に聞く
                  </>
                ) : (
                  <>{subject?.teacher?.displayName ?? "葵先生"}にこの教材について聞く</>
                )}
              </span>
            </div>
            {selectedChatNode && (
              <button
                type="button"
                onClick={() => setSelectedChatNode(null)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                教材全体に戻す
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* 過去の対話履歴 */}
          {aokiChatHistory.length > 0 && (
            <ul className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 max-h-[400px] overflow-y-auto">
              {aokiChatHistory.map((m, i) => (
                <li
                  key={i}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "ml-8 bg-primary/10 text-foreground"
                      : "mr-8 bg-card border border-border text-foreground",
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {m.role === "user" ? "あなた" : subject?.teacher?.displayName ?? "葵先生"}
                  </div>
                  {m.text}
                </li>
              ))}
              {aokiChatSending && (
                <li className="mr-8 rounded-md border border-dashed border-border bg-card px-3 py-2 text-sm italic text-muted-foreground">
                  {subject?.teacher?.displayName ?? "葵先生"}が考えてるよ…
                </li>
              )}
            </ul>
          )}
          <Textarea
            value={aokiChatDraft}
            onChange={(e) => setAokiChatDraft(e.target.value)}
            placeholder={
              selectedChatNode
                ? `例: 「${selectedChatNode.name}って何?」「${selectedChatNode.name}の例文を見せて」`
                : `例: 「この教材の第3章ってどんな内容?」「この問題集と前の教科書の違いは?」`
            }
            rows={3}
            disabled={aokiChatSending}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAokiChatSend();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] italic text-muted-foreground">
              ※ chat 履歴は in-memory、リロードで消えます (Phase 7 で永続化)
              {" / "}Ctrl+Enter で送信
            </p>
            <Button
              size="sm"
              disabled={
                aokiChatSending || aokiChatDraft.trim().length === 0
              }
              onClick={handleAokiChatSend}
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              <span>{aokiChatSending ? "送信中…" : "送信"}</span>
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
