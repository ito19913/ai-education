"use client";

/**
 * MaterialReadPane — 段階1-C「一緒にめくって読む」読書ビュー (2026-06-04)
 *
 * 教材 PDF を画面に表示し、生徒がページをめくりながら葵 (教科の先生) と一緒に読む
 * 専用フル幅ビュー。葵は「今表示しているページ画像」を vision で読んで、その場で
 * 本文に即して教える (推測でなく実本文準拠)。
 *
 * 設計 (grill 確定):
 * - PDF はセッション中だけ in-memory 保持 (session-pdf-store)。リロードで消える割り切り。
 * - めくりは生徒主導 (前/次/ジャンプ/単元ジャンプ)。葵は言葉で促すが画面は勝手にめくらない。
 * - 葵が見るのは今表示中の現在ページ1枚。送信時に renderPageToJpeg で画像化して渡す。
 * - 印刷ページ番号と物理ページのオフセットは v1 では無視 (単元ジャンプは近傍、手めくりで調整)。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  BookOpen,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  loadPdfDocument,
  renderPageToCanvas,
  renderPageToJpeg,
  renderCoverThumb,
  extractFullPageTextsFromDoc,
  type LoadedPdf,
} from "@/lib/admin/pdf-extract-text";
import { segmentConceptsFromText } from "@/lib/admin/segment-claude";
import { buildScanSegments } from "@/lib/admin/scan-segment-builder";
import { buildGuidedReadingPlan } from "@/lib/admin/guided-reading-claude";
import {
  buildAssignmentProblemPlan,
  detectAssignmentIssues,
  type DetectedAssignmentIssue,
} from "@/lib/admin/assignment-solve-claude";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { getSessionPdf, setSessionPdf } from "@/lib/admin/session-pdf-store";
import { downloadMaterialPdf } from "@/lib/materials/pdf-storage";
import {
  updateMaterialGuidedPlans,
  updateMaterialSegments,
} from "@/lib/materials/materials-repo";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import {
  respondViaAokiChat,
  type AokiChatMessage,
} from "@/lib/admin/aoki-chat-claude";
import { ResumePane } from "@/components/notes/ResumePane";
import { PageThumbnailRail } from "@/components/materials/PageThumbnailRail";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  findConceptForPage,
  findSegmentForPage,
  segmentPages,
} from "@/lib/notes/concept-for-page";
import { SubjectTeacherAvatar } from "@/components/ui/subject-teacher-avatar";
import { MarkdownText } from "@/components/chat/MarkdownText";
import {
  NotebookPen,
  Play,
  ListChecks,
  Check,
  CircleCheck,
  Mic,
  MicOff,
} from "lucide-react";
import type {
  AiExtractedNode,
  ConceptSegment,
  GuidedBlock,
  Material,
  NoteEntry,
  Resume,
  Subject,
} from "@/lib/learn/types";

type Props = {
  material: Material;
  subject: Subject | null;
  /** 体系図ノードから開いた時の初期ページ (印刷ページ番号≒物理ページの近傍、v1) */
  initialPage?: number;
  /**
   * 教材詳細の「読む」(まとまりごと) から来た時 true (2026-06-08)。
   * initialPage に該当する まとまり を「選択した段階」(一旦止まる) で開く。
   * ガイド読書 (青枠+解説) は子が「ここから読む」を押すまで自動開始しない。
   */
  selectUnitOnLoad?: boolean;
  /**
   * 表紙サムネ未生成の教材を開いた時、PDF 1 ページ目を描画した data URL を親へ渡す
   * (2026-06-08)。親が materials state + DB に保存し、教材一覧で表示する。
   */
  onCoverThumb?: (materialId: string, dataUrl: string) => void;
  onBack: () => void;
  /** R10: 出典→レジュメ 往復。この教材の科目のレジュメ一覧へ飛ぶ */
  onOpenResume?: () => void;
  /** まとめノート N9①: 能動ゲート通過でエントリを刻んだ時に親へ通知 */
  onNoteAdded?: (entry: NoteEntry) => void;
  /** 既にノート化済みの まとまり ID 集合 (M7: 次の未まとめ単元の提示に使う) */
  notedSegmentIds?: Set<string>;
  /** まとめノートのエントリ一覧 (G-C: 2 周目検知 + 既存エントリの深化更新に使う) */
  noteEntries?: NoteEntry[];
  /** R10 Phase 2: レジュメ冊一覧 (学習中の冊セレクター用、ResumePane へ渡す) */
  resumes?: Resume[];
  /** R10 Phase 2: 冊を追加 (学習中に新しい冊を作って入れる) */
  onAddResume?: (subjectId: string, name: string) => Promise<Resume | null>;
  /** 学習履歴 (2026-06-10): ガイド読書を始めた時に「読んだ」を記録 (同まとまり1日1回は親で丸め) */
  onLogRead?: (segmentId: string, conceptName: string) => void;
  /** 学習履歴 (2026-06-10): アクティブ 1 分ごとのハートビート (+1 分) */
  onStudyMinute?: () => void;
  /**
   * 宿題「AI と解く」(2026-06-11 grill 確定): 解説セッション末に葵が検知した
   * つまずきを親へ渡す (親が Issue として自動登録、監修なし)。
   */
  onAssignmentIssues?: (found: DetectedAssignmentIssue[]) => void;
  /** 宿題「AI と解く」: 子が「ぜんぶ解けた!」と宣言した時 (親が assignmentStatus=done に) */
  onAssignmentDone?: () => void;
  /**
   * ガイドプラン保存時に最新 map を親へ書き戻す (2026-06-12 レビュー指摘の修正)。
   * guidedPlansMap はマウント時の material.guidedPlans から初期化されるため、これが
   * 無いと「読書ビューを開き直す→別まとまりで保存」で古い map が DB を全置換し、
   * 他まとまりのプラン・手動調整した青枠が消えていた。
   */
  onGuidedPlansSaved?: (
    materialId: string,
    plans: Record<string, GuidedBlock[]>,
  ) => void;
};

// まとまり全体を vision で渡す時の最大ページ数 (payload / 速度の上限、M8)。
// これを超える単元は均等サンプリングして代表ページだけ渡す。
const MAX_SEGMENT_VISION_PAGES = 12;

/**
 * 「学習内容でない区切り」(表紙・前付け・目次・使い方・奥付・索引など) かを名前で判定。
 * 区切り生成プロンプト (segment-claude) でも出さないようにしているが、古いデータや
 * 取りこぼし対策として、学習開始時はこれをスキップして最初の本物の単元へ進む。
 */
function isFrontMatterName(name: string): boolean {
  return /表紙|扉|前付|まえがき|はじめに|序文|目次|もくじ|使い方|凡例|奥付|索引|さくいん|著者|広告|後付|あとがき/.test(
    name,
  );
}

/**
 * 区切り (ConceptSegment[]) のセッション内キャッシュ (materialId → segments)。
 * migration 未適用で DB 保存できない / 既存教材で未生成 の時、開くたびに葵が
 * その場で区切り直す (M4 のオンデマンド版)。同セッションでは 1 回だけ走る。
 */
const sessionSegmentCache = new Map<string, ConceptSegment[]>();

/**
 * オンデマンド区切りを「一度試した」教材 ID (成否問わず)。
 * スキャン本など区切りが 0 件で終わる教材を、再レンダのたびに延々と再生成し続ける
 * 無限ループを防ぐ (= 1 教材 1 回だけ試す)。成功時は sessionSegmentCache に入る。
 */
const attemptedSegmentation = new Set<string>();

/**
 * ガイド読書のブロックプラン (GuidedBlock[]) のセッション内キャッシュ (segment.id → blocks)。
 * 同じまとまりを開き直しても葵の vision 解析を 1 回で済ませる (G-A)。
 */
const sessionGuidedPlanCache = new Map<string, GuidedBlock[]>();

// ガイド読書のブロックプラン生成で vision に渡すまとまりページの上限 (大きすぎるまとまり対策)。
const GUIDED_MAX_PAGES = 16;

// 宿題「AI と解く」: 問題ブロック検出で vision に渡すページ上限 (宿題は数ページが普通)。
const ASSIGNMENT_MAX_PAGES = 12;

/** 範囲 [start,end] のページを最大 max 枚に均等サンプリングして返す。 */
function sampleRangePages(pages: number[], max: number): number[] {
  if (pages.length <= max) return pages;
  const out: number[] = [];
  const stepF = (pages.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(pages[Math.round(i * stepF)]);
  return [...new Set(out)];
}

/** "p.24-37" / "p.24-" などから開始ページ番号を取り出す。取れなければ null。 */
function parseStartPage(pageRange?: string): number | null {
  if (!pageRange) return null;
  const m = pageRange.match(/p\.?\s*(\d+)/i);
  return m ? Number.parseInt(m[1], 10) : null;
}

type Bbox = { x: number; y: number; w: number; h: number };

/**
 * ガイド読書の青枠ハイライト (手動調整つき)。
 * 枠本体をドラッグで移動、四隅のハンドルで拡大・縮小。座標は親 (ページ div) に対する
 * 正規化 (0-1)。AI 推定 bbox がズレた時、子がその場で直接ドラッグして直せる (ito19 要望)。
 */
function EditableHighlight({
  bbox,
  onChange,
  onCommit,
  onDragStart,
}: {
  bbox: Bbox;
  onChange: (b: Bbox) => void;
  /**
   * ドラッグ終了 (指を離した) 時に 1 回。指を離した画面座標を渡す (見開きで反対ページへ
   * またいだ時に、ドロップ先ページ/ブロックを親が特定するため)。DB 永続化もここ。
   */
  onCommit?: (dropClientX: number, dropClientY: number) => void;
  /** ドラッグ開始時に元 bbox を通知 (別ブロックへ動かした時の選択し直し判定用)。 */
  onDragStart?: (original: Bbox) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: string;
    px: number;
    py: number;
    start: Bbox;
    rw: number;
    rh: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  // 押した対象の data-handle 属性で「移動 (move)」か「四隅リサイズ (nw/ne/sw/se)」かを判定。
  // ※ ハンドラはレンダーごとに生成せず直接割り当てる (factory-in-render を避け、ref 警告を回避)。
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const box = ref.current;
    const parent = box?.parentElement;
    if (!box || !parent) return;
    const mode = (e.target as HTMLElement).dataset.handle ?? "move";
    const rect = parent.getBoundingClientRect();
    drag.current = {
      mode,
      px: e.clientX,
      py: e.clientY,
      start: { ...bbox },
      rw: rect.width || 1,
      rh: rect.height || 1,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    onDragStart?.({ ...bbox });
    box.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    const dx = (e.clientX - d.px) / d.rw;
    const dy = (e.clientY - d.py) / d.rh;
    let { x, y, w, h } = d.start;
    if (d.mode === "move") {
      x += dx;
      y += dy;
    } else {
      if (d.mode.includes("e")) w += dx;
      if (d.mode.includes("s")) h += dy;
      if (d.mode.includes("w")) {
        x += dx;
        w -= dx;
      }
      if (d.mode.includes("n")) {
        y += dy;
        h -= dy;
      }
    }
    w = Math.max(0.04, Math.min(1, w));
    h = Math.max(0.04, Math.min(1, h));
    x = Math.max(0, Math.min(1 - w, x));
    y = Math.max(0, Math.min(1 - h, y));
    onChange({ x, y, w, h });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    ref.current?.releasePointerCapture?.(e.pointerId);
    // pointercancel 等で座標が無い場合は最後に拾った move 座標を使う。
    const dropX = Number.isFinite(e.clientX) ? e.clientX : d.lastX;
    const dropY = Number.isFinite(e.clientY) ? e.clientY : d.lastY;
    onCommit?.(dropX, dropY);
  };

  const handlePos: Record<string, string> = {
    nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      title="枠をドラッグで移動 / 角をつまんでサイズ変更"
      className="absolute cursor-move touch-none rounded-sm border-2 border-sky-500/80 bg-sky-300/20 shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
      style={{
        left: `${bbox.x * 100}%`,
        top: `${bbox.y * 100}%`,
        width: `${bbox.w * 100}%`,
        height: `${bbox.h * 100}%`,
      }}
    >
      {(["nw", "ne", "sw", "se"] as const).map((c) => (
        <div
          key={c}
          data-handle={c}
          className={`absolute size-3 rounded-full border border-white bg-sky-600 shadow ${handlePos[c]}`}
        />
      ))}
    </div>
  );
}

export function MaterialReadPane({
  material,
  subject,
  initialPage,
  selectUnitOnLoad,
  onCoverThumb,
  onBack,
  onOpenResume,
  onNoteAdded,
  notedSegmentIds,
  noteEntries,
  resumes,
  onAddResume,
  onLogRead,
  onStudyMinute,
  onAssignmentIssues,
  onAssignmentDone,
  onGuidedPlansSaved,
}: Props) {
  // 狭い画面では縦スタック (rail は隠す)、広い画面では横3ペイン。
  const isMobile = useIsMobile();

  // 宿題「AI と解く」モード (2026-06-11 grill 確定): 紙で解いた宿題・テストを
  // 葵が 1 問ずつ全問解説する伴走。まとまり/レジュメ/ガイド読書の本用 UI は出さない。
  const assignmentMode = (material.kind ?? "book") === "assignment";

  const [loaded, setLoaded] = useState<LoadedPdf | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(initialPage && initialPage > 0 ? initialPage : 1);
  const [pageInput, setPageInput] = useState(String(page));
  const [loadError, setLoadError] = useState<"no-file" | "load-fail" | null>(null);
  // 段階1-B: session-pdf-store に無く Storage から DL 中 (リロード後の復元)。
  const [downloading, setDownloading] = useState(false);
  // 見開き (2ページ表示) ⇄ 単ページ。default = 見開き (ユーザー要望)。
  const [spread, setSpread] = useState(true);
  // レジュメモード (R6): 「レジュメにする」で教材を単一ページにし、横に ResumePane を出す。
  const [resumeMode, setResumeMode] = useState(false);
  // 左サムネレールの表示/非表示 (ito19 要望: 細く + 隠せるように)。default = 表示。
  const [railVisible, setRailVisible] = useState(true);
  // ガイド読書のブロックプラン {segmentId: GuidedBlock[]} (G-A 永続化、2026-06-07)。
  // DB (material.guidedPlans) を初期値にし、プラン生成・青枠の手動調整をここに反映して
  // DB へ書き戻す。プランを固定保存することで、子が動かした青枠 (block.bbox) が
  // 次回も同じブロックに当たる (生成順依存の block ID は作り直すとズレるため)。
  const [guidedPlansMap, setGuidedPlansMap] = useState<
    Record<string, GuidedBlock[]>
  >(() => material.guidedPlans ?? {});
  // 最新 map のミラー (persistGuidedPlans が stale closure を踏まないため)。
  const guidedPlansMapRef = useRef(guidedPlansMap);
  useEffect(() => {
    guidedPlansMapRef.current = guidedPlansMap;
  }, [guidedPlansMap]);
  // ズーム倍率。1 = エリアにフィット、>1 で拡大 (スクロール)。
  const [zoom, setZoom] = useState(1);
  // ページの縦横比 (width / height)。フィット計算に使う。
  const [pageAspect, setPageAspect] = useState(0.707); // A 判の縦置き目安、ロード後に実測で上書き
  // リサイズで再フィットさせるためのトリガ
  const [resizeTick, setResizeTick] = useState(0);

  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const viewerRef = useRef<HTMLDivElement>(null);

  // 今表示するページ番号 (見開きなら [page, page+1]、末尾なら片ページ)
  // レジュメモード中は横にレジュメ pane を置くため単一ページに強制 (R6)。
  const pagesToShow = useMemo(() => {
    if (resumeMode || !spread) return [page];
    const arr = [page];
    if (page + 1 <= (numPages || page + 1)) arr.push(page + 1);
    return arr;
  }, [resumeMode, spread, page, numPages]);

  // めくり幅 (見開きは2ページ進む)
  const step = spread ? 2 : 1;

  // 葵 chat (MaterialDetailView の実装を踏襲)
  const [history, setHistory] = useState<AokiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  // 音声で質問 (R4 と同じ Web Speech API。宿題「AI と解く」の質疑応答は音声メイン。
  // 本の読書でも使えるよう常時表示、非対応ブラウザでは 🎤 を出さない)。
  const speech = useSpeechRecognition();

  // まとまり (一単元=1概念) 区切り。
  // 優先: DB 永続 (material.conceptSegments) → セッション内でその場生成した localSegments。
  // migration 未適用や既存教材でも、開いた時に葵がその場で区切り直す (下の effect)。
  const [localSegments, setLocalSegments] = useState<ConceptSegment[] | null>(
    null,
  );
  const [segmenting, setSegmenting] = useState(false);
  const segments =
    material.conceptSegments && material.conceptSegments.length > 0
      ? material.conceptSegments
      : (localSegments ?? undefined);

  // 今表示中ページが属する まとまり (M7: 範囲提示・範囲要約の基準)。
  const currentSegment = useMemo(
    () => findSegmentForPage(page, segments),
    [page, segments],
  );

  // 学習対象になる「本物のまとまり」一覧 (前付け等を除き、ページ順)。
  // 開いた直後にこれを「グルーピング一覧」として見せ、子に選ばせる (入口)。
  const contentSegments = useMemo(
    () =>
      (segments ?? [])
        .filter((s) => !isFrontMatterName(s.conceptName))
        .sort((a, b) => a.startPdfPage - b.startPdfPage),
    [segments],
  );

  // 入口の「まとまり一覧」を表示中か (開いた直後 = true、単元を選ぶと false)。
  const [showUnitMenu, setShowUnitMenu] = useState(true);

  // 単元ジャンプ用リスト。
  // まとまりがあれば PDF 紙番号で正確にジャンプ (推奨)。無ければ従来の extractedNodes
  // (印刷ページ番号≒近傍、レガシー) にフォールバック。
  const unitJumps = useMemo(() => {
    if (segments && segments.length > 0) {
      return [...segments]
        .sort((a, b) => a.startPdfPage - b.startPdfPage)
        .map((s) => ({ name: s.conceptName, start: s.startPdfPage }));
    }
    return (material.extractedNodes ?? [])
      .map((n) => ({ name: n.name, start: parseStartPage(n.pageRange) }))
      .filter((u): u is { name: string; start: number } => u.start !== null);
  }, [segments, material.extractedNodes]);

  // ----- PDF ロード -----
  // 段階1-B: まず L1 キャッシュ (session-pdf-store) を見る。無ければ Storage の
  // pdfPath から DL してキャッシュ → ロード (リロード後の復元)。どちらも無ければ no-file。
  useEffect(() => {
    let cancelled = false;
    let local: LoadedPdf | null = null;

    const loadFromFile = (file: File) => {
      loadPdfDocument(file)
        .then((l) => {
          if (cancelled) {
            void l.destroy();
            return;
          }
          local = l;
          setLoaded(l);
          setNumPages(l.numPages);
          setPage((p) => Math.min(Math.max(p, 1), l.numPages));
          // 1 ページ目の縦横比を実測 (フィット計算用)
          l.doc
            .getPage(1)
            .then((p1) => {
              const vp = p1.getViewport({ scale: 1 });
              if (!cancelled && vp.width > 0 && vp.height > 0) {
                setPageAspect(vp.width / vp.height);
              }
              p1.cleanup();
            })
            .catch(() => {});
        })
        .catch((err) => {
          console.error("[読書] PDF ロード失敗:", err);
          if (!cancelled) setLoadError("load-fail");
        });
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadError(null);
    const cached = getSessionPdf(material.id);
    if (cached) {
      loadFromFile(cached);
    } else if (material.pdfPath) {
      // Storage から復元 (リロード後)。
      setDownloading(true);
      downloadMaterialPdf(material.pdfPath)
        .then((file) => {
          if (cancelled) return;
          setSessionPdf(material.id, file); // 次回・他ページのため L1 にキャッシュ
          setDownloading(false);
          loadFromFile(file);
        })
        .catch((err) => {
          console.error("[読書] Storage からの PDF 取得失敗:", err);
          if (!cancelled) {
            setDownloading(false);
            setLoadError("load-fail");
          }
        });
    } else {
      setLoadError("no-file");
    }

    return () => {
      cancelled = true;
      if (local) void local.destroy();
    };
  }, [material.id, material.pdfPath]);

  // ----- まとまり区切りのオンデマンド生成 (M4 フォールバック) -----
  // DB に区切りが無い (migration 未適用 / 既存教材 / まだ生成前) 場合、PDF が読めたら
  // その場で葵が全書を読んで区切る。セッション内キャッシュで 1 回だけ。デジタル PDF のみ
  // (文字レイヤー無し = スキャン本は対象外、将来 C-8)。
  // ★依存は [loaded, material.id, material.conceptSegments] だけにする★
  // segmenting / localSegments を deps に入れると、setSegmenting(true) で自エフェクトが
  // 再実行→ cleanup で in-flight をキャンセル→ segmenting=true のまま固まる (実機バグ)。
  // 再入防止は attemptedSegmentation (module Set) が担うので state を deps に入れない。
  useEffect(() => {
    // 宿題・テストは「まとまり」を作らない (登録時スキップと同じ判断。
    // 解く単位は問題ブロック = buildAssignmentProblemPlan が担う)。
    if (assignmentMode) return;
    const hasPersisted =
      !!material.conceptSegments && material.conceptSegments.length > 0;
    if (hasPersisted || !loaded) return;

    const cached = sessionSegmentCache.get(material.id);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalSegments(cached);
      return;
    }
    // 一度試した教材は再試行しない (スキャン本=0件 でも無限ループ・再生成しない)。
    if (attemptedSegmentation.has(material.id)) return;

    // 投げっぱなし (cancel しない)。途中でキャンセルすると setSegmenting(false) が
    // 走らず固まるため、必ず finally で false に戻す。再入は attempted が防ぐ。
    attemptedSegmentation.add(material.id);
    const doc = loaded.doc;
    setSegmenting(true);
    (async () => {
      // 生成できたまとまりを cache / state / DB に反映 (デジタル・スキャン共通)。
      const persist = (segs: ConceptSegment[]) => {
        if (segs.length === 0) return;
        sessionSegmentCache.set(material.id, segs);
        setLocalSegments(segs);
        // real モードなら DB に保存 → 次回開いた時は即表示 (再生成不要)。
        if (isSupabaseConfigured()) {
          updateMaterialSegments(material.id, segs).catch((e) =>
            console.error("[読書] まとまり保存失敗:", e),
          );
        }
      };
      try {
        // 表示用にロード済みの doc をそのまま使う (旧実装は session store の File を
        // もう 1 部ロードしていた = 186MB 級で二重常駐、Phase 2 メモリ対策)。
        const { hasTextLayer, packedText } = await extractFullPageTextsFromDoc(doc);
        if (hasTextLayer && packedText.length > 0) {
          // デジタル PDF: 本文テキストから PDF 紙番号で直接区切る (M3)。
          persist(
            await segmentConceptsFromText({
              materialName: material.name,
              subjectName: subject?.name ?? "教科",
              gradeLevel: material.gradeLevel ?? "中2",
              packedText,
            }),
          );
        } else {
          // C-8: スキャン本 (文字レイヤー無し) → ハイブリッド (目次土台 + オフセット較正)
          // or 全ページ vision 経路。
          persist(await buildScanSegments(doc, material, subject?.name ?? "教科"));
        }
      } catch (err) {
        console.error("[読書] まとまり生成失敗:", err);
      } finally {
        setSegmenting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, material.id, material.conceptSegments]);

  // ----- 表示中ページ (1 or 2 枚) を各 canvas に描画 (エリアにフィット × zoom) -----
  useEffect(() => {
    if (!loaded) return;
    const el = viewerRef.current;
    const containerW = el?.clientWidth ?? 800;
    const containerH = el?.clientHeight ?? 800;
    const per = pagesToShow.length;
    // zoom=1 で「幅・高さの小さい方」にフィット (= 見開き全体が収まる)。
    const fitByWidth = containerW / per; // 1 ページあたりに使える幅
    const fitByHeight = containerH * pageAspect; // 高さ基準でのページ幅
    const fitWidth = Math.max(40, Math.min(fitByWidth, fitByHeight));
    const targetW = fitWidth * zoom;
    pagesToShow.forEach((pn, i) => {
      const cv = canvasRefs.current[i];
      if (cv) {
        renderPageToCanvas(loaded.doc, pn, cv, targetW).catch((err) =>
          console.error("[読書] ページ描画失敗:", err),
        );
      }
    });
  }, [loaded, pagesToShow, zoom, pageAspect, resizeTick]);

  // ビューア領域のサイズ変化 (初回レイアウト・ウィンドウリサイズ・chat 幅変化) で再フィット
  useEffect(() => {
    const el = viewerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setResizeTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded, loadError]);

  // ページが変わったら入力欄も同期 (前/次ボタン・ジャンプで page が変わった時に追従)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageInput(String(page));
  }, [page]);

  // chat 履歴が伸びたら最下部にスクロール
  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history]);

  const goPrev = useCallback(() => setPage((p) => Math.max(1, p - step)), [step]);
  const goNext = useCallback(
    () => setPage((p) => Math.min(numPages || p, p + step)),
    [numPages, step],
  );
  const jumpTo = useCallback(
    (n: number) => setPage(Math.min(Math.max(1, n), numPages || n)),
    [numPages],
  );

  // ----- レジュメにする: 起動準備 (まとまり範囲の画像を pack して ResumePane を開く) -----
  const [gatePacked, setGatePacked] = useState("");
  const [gateConcept, setGateConcept] = useState<AiExtractedNode | null>(null);
  const [gateSegment, setGateSegment] = useState<ConceptSegment | null>(null);
  const [preparingGate, setPreparingGate] = useState(false);
  // フロー再設計: 学習セッション開始 (葵が今のページを自分から説明する)
  const [starting, setStarting] = useState(false);

  // ----- AI 主導ガイド読書 (G-A、2026-06-06) -----
  // まとまりを「教える順序のブロック」に分け、葵が一区切りずつ解説する。
  const [guidedBlocks, setGuidedBlocks] = useState<GuidedBlock[] | null>(null);
  // 青枠 bbox の手動調整を確定保存 (pointerUp) する時に最新ブロック列を読むための ref。
  const guidedBlocksRef = useRef<GuidedBlock[] | null>(null);
  const [guidedIndex, setGuidedIndex] = useState(0);
  const [guidedSegment, setGuidedSegment] = useState<ConceptSegment | null>(null);
  // 難易度: 0=やさしい / 1=ふつう / 2=詳しい (G-6、初回はやさしい。周回数連動は G-C)。
  const [guidedLevel, setGuidedLevel] = useState(0);
  const [guidedBusy, setGuidedBusy] = useState(false);
  // 「まとまりを選択した段階」(2026-06-08 ito19 さん意見): まとまりを選ぶ/読むを押すと
  // いきなりガイド読書を始めず、その まとまり を選択した状態で一旦止まる。
  // 子が「ここから読む」を押して初めて startGuided (青枠+解説) が走る。
  const [pendingSegment, setPendingSegment] = useState<ConceptSegment | null>(
    null,
  );

  // 指定ページ群を JPEG 化して改行連結 1 文字列にする (vision 用、共通)。
  const packPages = useCallback(
    async (pages: number[]): Promise<string | undefined> => {
      if (!loaded) return undefined;
      const imgs: string[] = [];
      for (const pn of pages) {
        if (pn < 1 || pn > numPages) continue;
        const b64 = await renderPageToJpeg(loaded.doc, pn);
        if (b64) imgs.push(b64);
      }
      return imgs.length > 0 ? imgs.join("\n") : undefined;
    },
    [loaded, numPages],
  );

  // ガイドプランを session キャッシュ + map + DB + 親 materials state へ一括反映する
  // 唯一の保存口 (startGuided / startAssignment / commitGuidedBbox が共用)。
  // ★親への書き戻し (onGuidedPlansSaved) が肝: これが無いと次回マウントの初期 map が
  // 古く、別まとまりの保存で他まとまりのプラン・青枠調整を DB から消していた
  // (2026-06-12 レビュー指摘の stale 全置換バグ修正)。
  const persistGuidedPlans = useCallback(
    (segId: string, blocks: GuidedBlock[]) => {
      sessionGuidedPlanCache.set(segId, blocks);
      const next = { ...guidedPlansMapRef.current, [segId]: blocks };
      guidedPlansMapRef.current = next;
      setGuidedPlansMap(next);
      if (isSupabaseConfigured()) {
        updateMaterialGuidedPlans(material.id, next).catch((e) =>
          console.error("[ガイド読書] プラン保存失敗:", e),
        );
      }
      onGuidedPlansSaved?.(material.id, next);
    },
    [material.id, onGuidedPlansSaved],
  );

  // M6: 指定した まとまり (target) のオリエンを葵に語らせる。範囲先頭へジャンプ →
  // 「今日はここ(p.X〜Y)を『○○』として勉強しよう。まず通して読もう」と案内 (2フェーズ①)。
  // target が null の時は「今表示ページの説明」フォールバック (まとまり未生成の本)。
  const runOrientation = useCallback(
    async (target: ConceptSegment | null) => {
      if (!loaded || starting || sending) return;
      setStarting(true);
      try {
        // 範囲があれば先頭ページへ移動 (子はページ番号を意識しない、M2/M3)。
        if (target) setPage(target.startPdfPage);

        // 渡す画像: まとまりがあれば範囲全体 (大きければサンプリング)、無ければ今表示ページ。
        const visionPages = target
          ? sampleRangePages(segmentPages(target), MAX_SEGMENT_VISION_PAGES)
          : pagesToShow;
        const packed = await packPages(visionPages);

        const userMessage = target
          ? `（学習を開始）今日のまとまりは「${target.conceptName}」、この本の ${target.startPdfPage}ページ〜${target.endPdfPage}ページ だよ。これは 1 つのまとまり(一単元)。次の順で、いきなり中身を詳しく説明せず軽く案内して:
1) まず「今日はここ(${target.startPdfPage}〜${target.endPdfPage}ページ)を『${target.conceptName}』というまとまりとして勉強していこう」と**範囲を伝える**。
2) 「ここではこういうことを学ぶよ」と、このまとまりで扱う内容を 2〜3 文でざっくり。
3) 「読むときはここに注目してね」と着目点を 1 つ。
4) 最後に「まずは一度ざっと通して読んでみよう。分からない所は飛ばして大丈夫。読み終えて『レジュメにする』を押したら、概念ごとに一緒にまとめていこうね。ここから始めていい?」と通読を促し、軽く確認する。`
          : "（学習を開始）今開いているページの要点を、中学生にわかるように2〜4文で説明して。最後に「分からないところがあれば聞いてね」と一言添えて。";

        const aiText = await respondViaAokiChat({
          materialName: material.name,
          subjectName: subject?.name ?? "教科",
          gradeLevel: material.gradeLevel ?? "中2",
          focusNodeName: target?.conceptName ?? null,
          history,
          userMessage,
          currentPageImagesPacked: packed,
          currentPageNumber: target?.startPdfPage ?? page,
        });
        // 葵の説明だけを積む (キックオフ発話は可視 history に出さない = 自分から説明したように見せる)
        setHistory((prev) => [...prev, { role: "assistant", text: aiText }]);
      } catch (err) {
        console.error("[読書] 学習開始失敗:", err);
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "ごめん、今うまく読み取れなかった…ページをめくり直すか、もう一度試してくれる?",
          },
        ]);
      } finally {
        setStarting(false);
      }
    },
    [loaded, starting, sending, pagesToShow, packPages, material, subject, page, history],
  );

  // ----- ガイド読書: 1 ブロックを葵が解説する (G-A) -----
  // 葵が「このブロックだけ」を、難易度 level に応じて説明し、最後に「次に行く?」と促す。
  // ガイド用の userMessage は可視 history に積まない (葵が自分から説明したように見せる)。
  const explainGuidedBlock = useCallback(
    async (
      blocks: GuidedBlock[],
      index: number,
      level: number,
      conceptName: string,
    ) => {
      const block = blocks[index];
      if (!block || !loaded) return;
      setGuidedIndex(index);
      // 既に見えているページ (見開きの左右どちらか) ならめくらず、ハイライトだけ隣へ動かす。
      // 見えていないページの時だけ移動 (見開きの中で左→右へ自然に進める)。
      setPage((cur) =>
        block.pdfPage === cur || (spread && block.pdfPage === cur + 1)
          ? cur
          : block.pdfPage,
      );
      const packed = await packPages([block.pdfPage]);
      const levelText =
        level <= 0
          ? "中学生にやさしい言葉で、短めに"
          : level === 1
            ? "中学生に分かるように、ふつうの詳しさで"
            : "もう少し踏み込んで、正式な用語も交えて";
      const suppText = block.supplementary
        ? "これは本文の補足 (POINT/MEMO など) だよ。本文の要点をおさらいする感じで、"
        : "";
      const posText = block.positionHint ? `（${block.positionHint}あたり）` : "";
      // 宿題「AI と解く」: 解き終わった問題の解説 (解答はワークにある前提なので答えを
      // 隠さない。①考え方 ②筋道 ③答えの確認 → 「合ってた?」は子の自己申告)。
      const userMessage = assignmentMode
        ? `（宿題の解説）問題「${block.label}」${posText}を ${levelText} 解説して。①この問題の考え方 → ②解き方の筋道 → ③答えの確認、の順で、この問題だけに絞って。最後に「答え、合ってた?」と聞いてね。計算や答えに確信が持てない時は「ここは学校の解答でも確認してね」と一言添えること。`
        : `（ガイド読書）${suppText}次は「${block.label}」${posText}を ${levelText} 説明して。今このブロックだけに絞って、長くなりすぎないように。最後に「ここまで大丈夫? 次に行く?」と一言添えてね。`;
      const aiText = await respondViaAokiChat({
        materialName: material.name,
        subjectName: subject?.name ?? "教科",
        gradeLevel: material.gradeLevel ?? "中2",
        focusNodeName: conceptName || block.label,
        history,
        userMessage,
        currentPageImagesPacked: packed,
        currentPageNumber: block.pdfPage,
      });
      setHistory((prev) => [...prev, { role: "assistant", text: aiText }]);
    },
    [loaded, spread, packPages, material, subject, history, assignmentMode],
  );

  // 入口の一覧から まとまり を選んだ時: ガイド読書を開始 (ブロックプラン生成 → 最初を解説)。
  const startGuided = useCallback(
    async (seg: ConceptSegment) => {
      if (!loaded || starting || sending || guidedBusy) return;
      setShowUnitMenu(false);
      setGuidedSegment(seg);
      // 学習履歴 (2026-06-10): 「まとまりを葵と読んだ」を自動記録 (1日1回は親で丸め)
      onLogRead?.(seg.id, seg.conceptName);
      // G-6: 2 周目以降 (既にノート化済み) は最初からやや踏み込んだ難易度で始める。
      setGuidedLevel(notedSegmentIds?.has(seg.id) ? 1 : 0);
      setGuidedBusy(true);
      try {
        setPage(seg.startPdfPage);
        // 短いオリエン (API 不要のテンプレ)。
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `「${seg.conceptName}」を一緒に見ていこう📖\n読みたい所を **「前 / 次」やページのタップ** で選んで(青い枠が動くよ)、**「ここを解説」**を押すと、わたしがそこを説明するね。むずかしかったら **やさしく**、聞きたいことはいつでも入力してOK。`,
          },
        ]);
        // ブロックプランの取得優先順: ①永続化済み (DB/local map) ②session キャッシュ
        // ③無ければ Opus vision で生成。一度作れば概念ごと 1 回で済む (G-A 永続化)。
        let blocks =
          guidedPlansMap[seg.id] ?? sessionGuidedPlanCache.get(seg.id);
        let generated = false;
        if (!blocks) {
          const pages = sampleRangePages(segmentPages(seg), GUIDED_MAX_PAGES);
          const packed = await packPages(pages);
          blocks = packed
            ? await buildGuidedReadingPlan({
                materialName: material.name,
                subjectName: subject?.name ?? "教科",
                gradeLevel: material.gradeLevel ?? "中2",
                conceptName: seg.conceptName,
                imagesPacked: packed,
                pageNumbers: pages,
              })
            : [];
          generated = blocks.length > 0;
        }
        // ブロック化できなければ、まとまり全体を 1 ブロック扱いにフォールバック。
        if (!blocks || blocks.length === 0) {
          blocks = [
            {
              id: "blk-1",
              label: seg.conceptName,
              pdfPage: seg.startPdfPage,
              kind: "body",
              supplementary: false,
            },
          ];
          generated = true; // フォールバックも保存対象 (ロジック統一・以後再生成しない)
        }
        // 新規生成したプランは session キャッシュ + map + DB + 親 state へ反映。
        if (generated) {
          persistGuidedPlans(seg.id, blocks);
        }
        // 最初のブロックを「選択」状態にする (まだ読まない、G-2)。子が「ここを解説」で読む。
        setGuidedBlocks(blocks);
        setGuidedIndex(0);
        setPage(blocks[0]?.pdfPage ?? seg.startPdfPage);
      } catch (err) {
        console.error("[ガイド読書] 開始失敗:", err);
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "ごめん、うまく準備できなかった…もう一度試してくれる?",
          },
        ]);
      } finally {
        setGuidedBusy(false);
      }
    },
    [
      loaded,
      starting,
      sending,
      guidedBusy,
      packPages,
      material,
      subject,
      notedSegmentIds,
      guidedPlansMap,
      onLogRead,
      persistGuidedPlans,
    ],
  );

  // まとまりを「選択した段階」で開く (一旦止まる)。ページは先頭へ。ガイド読書は始めない。
  // 別まとまりを選び直した時のために、進行中のガイド状態はリセットする。
  const selectUnit = useCallback(
    (seg: ConceptSegment) => {
      if (!loaded) return;
      setShowUnitMenu(false);
      setGuidedSegment(null);
      setGuidedBlocks(null);
      setGuidedIndex(0);
      setPendingSegment(seg);
      setPage(seg.startPdfPage);
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `「${seg.conceptName}」を選んだよ📖\nこの本の ${seg.startPdfPage}〜${seg.endPdfPage}ページ。準備ができたら **「ここから読む」** を押してね。先に自分でめくって眺めてもOKだよ。`,
        },
      ]);
    },
    [loaded],
  );

  // 「ここから読む」: 選択中の まとまり でガイド読書 (青枠+解説) を開始する。
  const beginGuided = useCallback(() => {
    const seg = pendingSegment;
    if (!seg) return;
    setPendingSegment(null);
    void startGuided(seg);
  }, [pendingSegment, startGuided]);

  // ----- 宿題「AI と解く」(2026-06-11 grill 確定) -----
  // 「一緒に解く」: 問題ブロックを検出 (1 回だけ・guided_plans に永続化) して伴走を開始。
  // 進行状態は保存しない (紙が真実の情報源)。子が問題を選んで「この問題を解説」で進む。
  const startAssignment = useCallback(async () => {
    if (!loaded || guidedBusy || sending) return;
    setGuidedBusy(true);
    // 擬似まとまり: 既存のガイド読書機構 (青枠調整の commit / guided_plans 永続化) に
    // そのまま乗せるための器。id は教材スコープで安定 (session キャッシュの衝突回避に
    // material.id を含める)。
    const pseudoSeg: ConceptSegment = {
      id: `assignment-${material.id}`,
      conceptName: material.name,
      startPdfPage: 1,
      endPdfPage: numPages || 1,
      source: "manual",
    };
    setGuidedSegment(pseudoSeg);
    setGuidedLevel(0);
    onLogRead?.(pseudoSeg.id, `宿題: ${material.name}`);
    setHistory((prev) => [
      ...prev,
      {
        role: "assistant",
        text: `宿題を一緒にやっていこう✏️\n紙で解けたところから、1 問ずつ確認していくよ。**「前 / 次」や問題のタップ**で解き終わった問題を選んで(青い枠が動くよ)、**「この問題を解説」**を押してね。解説のあと、答えが合ってたかも教えて。わからない事はいつでも聞いてOK!`,
      },
    ]);
    try {
      // 問題ブロックの取得優先順: ①永続化済み ②session キャッシュ ③Opus vision 生成。
      let blocks =
        guidedPlansMap[pseudoSeg.id] ?? sessionGuidedPlanCache.get(pseudoSeg.id);
      let generated = false;
      if (!blocks) {
        const allPages = Array.from(
          { length: numPages || 1 },
          (_, i) => i + 1,
        );
        const pages = sampleRangePages(allPages, ASSIGNMENT_MAX_PAGES);
        const packed = await packPages(pages);
        blocks = packed
          ? await buildAssignmentProblemPlan({
              materialName: material.name,
              subjectName: subject?.name ?? "教科",
              gradeLevel: material.gradeLevel ?? "中2",
              imagesPacked: packed,
              pageNumbers: pages,
            })
          : [];
        generated = blocks.length > 0;
      }
      // 問題を検出できなければ宿題全体 1 ブロックにフォールバック (動線は止めない)。
      if (!blocks || blocks.length === 0) {
        blocks = [
          {
            id: "blk-1",
            label: "この宿題",
            pdfPage: 1,
            kind: "example",
            supplementary: false,
          },
        ];
        generated = true;
      }
      if (generated) {
        persistGuidedPlans(pseudoSeg.id, blocks);
      }
      setGuidedBlocks(blocks);
      setGuidedIndex(0);
      setPage(blocks[0]?.pdfPage ?? 1);
    } catch (err) {
      console.error("[AIと解く] 開始失敗:", err);
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "ごめん、うまく準備できなかった…もう一度試してくれる?",
        },
      ]);
    } finally {
      setGuidedBusy(false);
    }
  }, [
    loaded,
    guidedBusy,
    sending,
    numPages,
    packPages,
    material,
    subject,
    guidedPlansMap,
    onLogRead,
    persistGuidedPlans,
  ]);

  // セッションの締め: つまずきをまとめて検知して親へ (自動 Issue 化、監修なし)。
  // allDone=true (「ぜんぶ解けた!」= 子の宣言) なら宿題を「やった」にする。
  const finishAssignment = useCallback(
    async (allDone: boolean) => {
      if (sending || guidedBusy) return;
      setGuidedBusy(true);
      try {
        let found: DetectedAssignmentIssue[] = [];
        // 解説のやり取りが何も無ければ検知はスキップ (開いてすぐ閉じた等)。
        if (history.some((m) => m.role === "user")) {
          try {
            found = await detectAssignmentIssues({
              materialName: material.name,
              subjectName: subject?.name ?? "教科",
              gradeLevel: material.gradeLevel ?? "中2",
              historyPacked: history
                .map((m) => `${m.role === "user" ? "子" : "葵"}: ${m.text}`)
                .join("\n"),
            });
          } catch (err) {
            console.error("[AIと解く] つまずき検知失敗:", err);
          }
        }
        if (found.length > 0) onAssignmentIssues?.(found);
        const issueText =
          found.length > 0
            ? `今日引っかかってたのは ${found
                .map((f) => `「${f.concept}」`)
                .join("・")} みたいだね。課題にしておいたから、また一緒に振り返ろう。\n`
            : "";
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: allDone
              ? `${issueText}おつかれさま🎉 この宿題は「やった」にしておくね!`
              : `${issueText}今日はここまで! つづきもがんばろうね✏️`,
          },
        ]);
        if (allDone) onAssignmentDone?.();
      } finally {
        setGuidedBusy(false);
      }
    },
    [
      sending,
      guidedBusy,
      history,
      material,
      subject,
      onAssignmentIssues,
      onAssignmentDone,
    ],
  );

  // 教材詳細の「読む」(まとまりごと) から来た時 (selectUnitOnLoad): initialPage に
  // 該当する まとまり を「選択した段階」で開く。まとまりは登録時バックグラウンド or
  // オンデマンドで遅れて出来るので、出来てから 1 回だけ実行する。
  const didAutoSelectRef = useRef(false);
  useEffect(() => {
    if (!selectUnitOnLoad || didAutoSelectRef.current) return;
    if (!loaded || contentSegments.length === 0) return;
    const p = initialPage ?? -1;
    const target =
      contentSegments.find((s) => s.startPdfPage === p) ??
      contentSegments.find((s) => p >= s.startPdfPage && p <= s.endPdfPage);
    if (!target) return;
    didAutoSelectRef.current = true;
    // 詳細「読む」から来た時の 1 回限りの選択 (まとまり準備が整い次第)。意図的な set。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    selectUnit(target);
  }, [selectUnitOnLoad, loaded, contentSegments, initialPage, selectUnit]);

  // 表紙サムネ未生成の教材を開いた時、PDF が読み込めたら 1 ページ目を小さく描画して
  // 親へ渡す (親が DB 保存 → 教材一覧で表示)。既に PDF はメモリにあるので追加 DL なし。1 回だけ。
  const didCoverThumbRef = useRef(false);
  useEffect(() => {
    if (didCoverThumbRef.current) return;
    if (!loaded || !onCoverThumb || material.coverThumb) return;
    didCoverThumbRef.current = true;
    const doc = loaded.doc;
    void (async () => {
      try {
        const thumb = await renderCoverThumb(doc);
        if (thumb) onCoverThumb(material.id, thumb);
      } catch (err) {
        console.error("[読書] 表紙サムネ生成失敗:", err);
      }
    })();
  }, [loaded, onCoverThumb, material.coverThumb, material.id]);

  // 学習履歴 (2026-06-10): アクティブ時間のハートビート。
  // タブが見えていて、直近 3 分以内に操作 (pointer/key/wheel) がある時だけ毎分 +1。
  // 離席・放置タブは数えない (正直な数字)。セッション開始/終了の境界問題を構造的に回避。
  const lastInteractionRef = useRef(0);
  useEffect(() => {
    if (!onStudyMinute) return;
    lastInteractionRef.current = Date.now();
    const touch = () => {
      lastInteractionRef.current = Date.now();
    };
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    window.addEventListener("wheel", touch, { passive: true });
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInteractionRef.current > 3 * 60 * 1000) return;
      onStudyMinute();
    }, 60 * 1000);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("wheel", touch);
      window.clearInterval(id);
    };
  }, [onStudyMinute]);

  // guidedBlocks の最新値を ref へ同期 (commit 時に stale を避ける)。
  useEffect(() => {
    guidedBlocksRef.current = guidedBlocks;
  }, [guidedBlocks]);

  // 青枠ドラッグ開始時の元 bbox (別ブロックへ動かした時に元へ戻す判定用)。
  const preDragBboxRef = useRef<Bbox | null>(null);

  // 青枠ドラッグ中: 今のブロック (guidedIndex) の bbox をライブ更新 (見た目が即追従)。
  // DB へは書かず、ローカル state (= プラン) だけ動かす。
  const editGuidedBbox = useCallback(
    (bbox: Bbox) => {
      setGuidedBlocks((blocks) => {
        if (!blocks || !blocks[guidedIndex]) return blocks;
        const next = blocks.slice();
        next[guidedIndex] = { ...next[guidedIndex], bbox };
        return next;
      });
    },
    [guidedIndex],
  );

  // 青枠ドラッグ終了 (pointerUp): 調整済みプランを session キャッシュ + map に焼き込み、
  // DB へ 1 回だけ永続化する (移動中は飛ばさない、Q2)。失敗はログのみ。
  const commitGuidedBbox = useCallback(
    (dropX?: number, dropY?: number) => {
      const seg = guidedSegment;
      const blocks = guidedBlocksRef.current;
      const pre = preDragBboxRef.current;
      preDragBboxRef.current = null;
      if (!seg || !blocks) return;

      // ★指を離した位置 (画面座標) からドロップ先ページ+ブロックを特定する。
      // 見えている各ページ canvas の矩形でヒットテスト → 見開きで反対ページもまたげる。
      if (dropX !== undefined && dropY !== undefined) {
        let target = -1;
        for (let i = 0; i < pagesToShow.length; i++) {
          const cv = canvasRefs.current[i];
          if (!cv) continue;
          const r = cv.getBoundingClientRect();
          if (
            dropX < r.left ||
            dropX > r.right ||
            dropY < r.top ||
            dropY > r.bottom ||
            r.width === 0 ||
            r.height === 0
          ) {
            continue;
          }
          const pn = pagesToShow[i];
          const nx = (dropX - r.left) / r.width;
          const ny = (dropY - r.top) / r.height;
          // 点を含む最小ブロック優先、無ければそのページ内で中心が最も近いブロック。
          let bestArea = Number.POSITIVE_INFINITY;
          blocks.forEach((b, idx) => {
            if (b.pdfPage !== pn || !b.bbox) return;
            const { x, y, w, h } = b.bbox;
            if (nx >= x && nx <= x + w && ny >= y && ny <= y + h && w * h < bestArea) {
              bestArea = w * h;
              target = idx;
            }
          });
          if (target === -1) {
            let bestDist = Number.POSITIVE_INFINITY;
            blocks.forEach((b, idx) => {
              if (b.pdfPage !== pn || !b.bbox) return;
              const cx = b.bbox.x + b.bbox.w / 2;
              const cy = b.bbox.y + b.bbox.h / 2;
              const d = (nx - cx) ** 2 + (ny - cy) ** 2;
              if (d < bestDist) {
                bestDist = d;
                target = idx;
              }
            });
          }
          break;
        }
        // 別ブロック (同ページ or 反対ページ) へ動かした = 選択し直し。
        // 元ブロックの枠は pre に戻し (移動を取り消し)、対象ブロックを選択。保存しない。
        if (target >= 0 && target !== guidedIndex) {
          const reverted = blocks.slice();
          if (pre) reverted[guidedIndex] = { ...reverted[guidedIndex], bbox: pre };
          guidedBlocksRef.current = reverted;
          setGuidedBlocks(reverted);
          setGuidedIndex(target);
          const tp = reverted[target]?.pdfPage;
          if (tp) {
            setPage((cur) =>
              tp === cur || (spread && tp === cur + 1) ? cur : tp,
            );
          }
          return;
        }
      }

      // 同じブロック内の微調整: session キャッシュ + map + DB + 親 state へ 1 回だけ永続化。
      persistGuidedPlans(seg.id, blocks);
    },
    [guidedSegment, guidedIndex, pagesToShow, spread, persistGuidedPlans],
  );

  // 選択カーソルを動かす (API なし・即時)。ハイライトと表示ページだけ動かし、まだ読まない。
  // → 子が「次/前/タップ」で読む所と順序を自由に選んでから「ここを解説」で読める。
  const moveCursor = useCallback(
    (index: number) => {
      if (!guidedBlocks) return;
      const clamped = Math.min(guidedBlocks.length - 1, Math.max(0, index));
      setGuidedIndex(clamped);
      const block = guidedBlocks[clamped];
      if (block) {
        setPage((cur) =>
          block.pdfPage === cur || (spread && block.pdfPage === cur + 1)
            ? cur
            : block.pdfPage,
        );
      }
    },
    [guidedBlocks, spread],
  );

  // 「ここを解説」: 今選択中 (カーソル) のブロックを葵が読む (API)。
  const explainCursor = useCallback(async () => {
    if (!guidedBlocks || guidedBusy || sending) return;
    setGuidedBusy(true);
    try {
      await explainGuidedBlock(
        guidedBlocks,
        guidedIndex,
        guidedLevel,
        guidedSegment?.conceptName ?? "",
      );
    } catch (err) {
      // 黙って失敗しない (2026-06-12 レビュー指摘): スピナーが消えるだけだと
      // 子は再試行すべきか分からない。handleSend と同じく葵の発話で伝える。
      console.error("[ガイド読書] 解説失敗:", err);
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "ごめん、うまく説明できなかった…もう一回「ここを解説」を押してみてくれる?",
        },
      ]);
    } finally {
      setGuidedBusy(false);
    }
  }, [
    guidedBlocks,
    guidedBusy,
    sending,
    guidedIndex,
    guidedLevel,
    guidedSegment,
    explainGuidedBlock,
  ]);

  // 「もっと簡単に / もっと詳しく」: 難易度を上下して今のブロックを言い直す (G-6)。
  const adjustGuidedLevel = useCallback(
    async (delta: number) => {
      if (!guidedBlocks || guidedBusy || sending) return;
      const newLevel = Math.min(2, Math.max(0, guidedLevel + delta));
      setGuidedLevel(newLevel);
      setGuidedBusy(true);
      try {
        await explainGuidedBlock(
          guidedBlocks,
          guidedIndex,
          newLevel,
          guidedSegment?.conceptName ?? "",
        );
      } catch (err) {
        // 黙って失敗しない (2026-06-12 レビュー指摘、explainCursor と同パターン)。
        console.error("[ガイド読書] 説明調整失敗:", err);
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "ごめん、うまく言い直せなかった…もう一回押してみてくれる?",
          },
        ]);
      } finally {
        setGuidedBusy(false);
      }
    },
    [
      guidedBlocks,
      guidedBusy,
      sending,
      guidedLevel,
      guidedIndex,
      guidedSegment,
      explainGuidedBlock,
    ],
  );

  // ページをタップ → その位置のブロックを「選択」する (G-2、読まずに選ぶだけ)。
  // bbox が点を含む最小ブロック優先、無ければそのページ内で中心が最も近いブロック。
  const handlePageClick = useCallback(
    (pn: number, e: ReactMouseEvent<HTMLDivElement>) => {
      if (!guidedBlocks || guidedBusy || sending) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      let best = -1;
      let bestArea = Number.POSITIVE_INFINITY;
      guidedBlocks.forEach((b, i) => {
        if (b.pdfPage !== pn || !b.bbox) return;
        const { x: bx, y: by, w, h } = b.bbox;
        if (x >= bx && x <= bx + w && y >= by && y <= by + h && w * h < bestArea) {
          bestArea = w * h;
          best = i;
        }
      });
      if (best === -1) {
        let bestDist = Number.POSITIVE_INFINITY;
        guidedBlocks.forEach((b, i) => {
          if (b.pdfPage !== pn || !b.bbox) return;
          const cx = b.bbox.x + b.bbox.w / 2;
          const cy = b.bbox.y + b.bbox.h / 2;
          const d = (x - cx) ** 2 + (y - cy) ** 2;
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
      }
      if (best >= 0) moveCursor(best);
    },
    [guidedBlocks, guidedBusy, sending, moveCursor],
  );

  // R6/M8: 「レジュメにする」= まとまり (一単元) 全体を vision で渡せるよう画像を pack し、
  // 教材を単一ページにして横に ResumePane を開く。まとまりが無ければ今表示ページで代用。
  const openResume = useCallback(async () => {
    if (!loaded || preparingGate) return;
    setPreparingGate(true);
    try {
      const seg = currentSegment;
      const visionPages = seg
        ? sampleRangePages(segmentPages(seg), MAX_SEGMENT_VISION_PAGES)
        : pagesToShow;
      const packed = await packPages(visionPages);
      setGatePacked(packed ?? "");
      setGateSegment(seg);
      // レガシー目次ノード (印刷番号) はまとまりが無い時だけ概念名ヒントに使う。
      setGateConcept(
        seg ? null : findConceptForPage(page, material.extractedNodes),
      );
      // まとまり先頭へジャンプ (子はページ番号を意識しない、R6)。
      if (seg) setPage(seg.startPdfPage);
      setResumeMode(true);
    } catch (err) {
      console.error("[読書] レジュメ準備失敗:", err);
    } finally {
      setPreparingGate(false);
    }
  }, [
    loaded,
    preparingGate,
    currentSegment,
    pagesToShow,
    packPages,
    page,
    material.extractedNodes,
  ]);

  const handleSend = async () => {
    const userMessage = draft.trim();
    if (userMessage.length === 0 || sending) return;
    setSending(true);
    const newHistory = [...history, { role: "user" as const, text: userMessage }];
    setHistory(newHistory);
    setDraft("");
    try {
      // 今表示している全ページ (見開きなら2枚) を JPEG 化して vision で渡す
      let packed: string | undefined;
      if (loaded) {
        const imgs: string[] = [];
        for (const pn of pagesToShow) {
          const b64 = await renderPageToJpeg(loaded.doc, pn);
          if (b64) imgs.push(b64);
        }
        if (imgs.length > 0) packed = imgs.join("\n");
      }
      const aiText = await respondViaAokiChat({
        materialName: material.name,
        subjectName: subject?.name ?? "教科",
        gradeLevel: material.gradeLevel ?? "中2",
        focusNodeName: null,
        history,
        userMessage,
        currentPageImagesPacked: packed,
        currentPageNumber: page,
      });
      setHistory([...newHistory, { role: "assistant", text: aiText }]);
    } catch (err) {
      console.error("[読書] aoki-chat failed:", err);
      setHistory([
        ...newHistory,
        {
          role: "assistant",
          text: "ごめん、今うまく読み取れなかった…もう一度送ってくれる?",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // ----- 段階1-B: Storage から PDF を復元中 -----
  if (downloading && !loaded) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 bg-canvas p-8 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <div className="text-sm text-muted-foreground">
          PDF を読み込み中…
          <br />
          （保存した教材をクラウドから復元しています）
        </div>
      </div>
    );
  }

  // ----- PDF が無い / ロード失敗時 -----
  if (loadError) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 bg-canvas p-8 text-center">
        <BookOpen className="size-10 text-muted-foreground" />
        <div className="max-w-md text-sm text-muted-foreground">
          {loadError === "no-file" ? (
            <>
              この教材の PDF は今のセッションに残っていないため、一緒に読めません。
              <br />
              （現状は mock のため、ページを再読み込みすると PDF は消えます。お手数ですが教材をもう一度登録してください。Supabase 永続化で解消予定です）
            </>
          ) : (
            <>PDF の読み込みに失敗しました。ファイルが壊れているか、大きすぎる可能性があります。</>
          )}
        </div>
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="size-4" />
          <span>教材詳細に戻る</span>
        </Button>
      </div>
    );
  }

  // 葵 chat を華やかに: 科目の先生アバター + 名前
  const teacherSubjectId = subject?.id ?? "subj-english";
  const teacherName = subject?.teacher?.displayName ?? "葵先生";
  const teacherAvatarLetter = subject?.teacher?.avatarLetter;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-canvas">
      {/* 上部バー */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-4" />
          <span>戻る</span>
        </Button>
        <BookOpen className="size-4 text-primary" />
        <span className="truncate text-sm font-medium">{material.name}</span>
        <div className="ml-auto flex items-center gap-3">
          {!assignmentMode && onOpenResume && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenResume}
              className="gap-1.5"
              title="この教科のレジュメ一覧を見る"
            >
              <NotebookPen className="size-4" />
              <span>レジュメを見る</span>
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {assignmentMode ? "葵先生と一緒に解く" : "葵先生と一緒に読む"}
          </span>
        </div>
      </div>

      {/* 本体: 広い画面=横3ペイン (ハンドルをドラッグで幅可変)、狭い画面=縦スタック */}
      <ResizablePanelGroup
        orientation={isMobile ? "vertical" : "horizontal"}
        className="flex min-h-0 flex-1"
      >
        {/* 左端の縦スライダー (全ページサムネ + まとまり色分け、見る地図、M5)。
            広い画面だけ表示。ハンドルで幅可変。 */}
        {!isMobile && railVisible && (
          <>
            <ResizablePanel
              id="rail"
              defaultSize={78}
              minSize={66}
              maxSize={420}
              className="min-w-0 border-r border-border"
            >
              <PageThumbnailRail
                doc={loaded?.doc ?? null}
                numPages={numPages}
                currentPage={page}
                segments={segments}
                currentSegmentId={currentSegment?.id ?? null}
                notedSegmentIds={notedSegmentIds}
                onJump={jumpTo}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        {/* PDF ビューア */}
        <ResizablePanel
          id="viewer"
          defaultSize={isMobile ? "58%" : "55%"}
          minSize="30%"
          className="min-w-0"
        >
          <div className="flex h-full min-h-0 flex-col">
          {/* ページコントロール */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-2 py-1">
            {/* 左サムネレールの表示/非表示トグル (広い画面のみ)。 */}
            {!isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRailVisible((v) => !v)}
                className="px-2"
                title={railVisible ? "ページ一覧を隠す" : "ページ一覧を表示"}
                aria-label={railVisible ? "ページ一覧を隠す" : "ページ一覧を表示"}
              >
                {railVisible ? (
                  <PanelLeftClose className="size-4" />
                ) : (
                  <PanelLeftOpen className="size-4" />
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={page <= 1 || !loaded}
              className="gap-1"
            >
              <ChevronLeft className="size-4" />
              <span>前</span>
            </Button>
            <div className="flex items-center gap-1 text-sm">
              <Input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const n = Number.parseInt(pageInput, 10);
                    if (!Number.isNaN(n)) jumpTo(n);
                  }
                }}
                onBlur={() => {
                  const n = Number.parseInt(pageInput, 10);
                  if (!Number.isNaN(n)) jumpTo(n);
                  else setPageInput(String(page));
                }}
                className="h-8 w-16 text-center"
                inputMode="numeric"
                aria-label="ページ番号"
              />
              <span className="text-muted-foreground">/ {numPages || "…"}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={goNext}
              disabled={(numPages > 0 && page >= numPages) || !loaded}
              className="gap-1"
            >
              <span>次</span>
              <ChevronRight className="size-4" />
            </Button>

            {/* 見開き ⇄ 単ページ 切替 */}
            <Button
              variant={spread ? "default" : "outline"}
              size="sm"
              onClick={() => setSpread((s) => !s)}
              className="gap-1"
              title="見開き / 単ページ を切り替え"
            >
              <BookOpen className="size-4" />
              <span>{spread ? "見開き" : "単ページ"}</span>
            </Button>

            {/* ズーム (フィット = 100%、% クリックでフィットに戻す) */}
            <div className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))
                }
                disabled={!loaded || zoom <= 0.5}
                className="px-2"
                aria-label="縮小"
              >
                <ZoomOut className="size-4" />
              </Button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                disabled={!loaded}
                className="w-12 text-center text-xs text-muted-foreground hover:text-foreground"
                title="フィットに戻す"
              >
                {Math.round(zoom * 100)}%
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))
                }
                disabled={!loaded || zoom >= 3}
                className="px-2"
                aria-label="拡大"
              >
                <ZoomIn className="size-4" />
              </Button>
            </div>

            {/* 単元ジャンプ (近傍、v1) */}
            {unitJumps.length > 0 && (
              <select
                className="ml-auto h-8 rounded-md border border-border bg-background px-2 text-sm"
                value=""
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(n)) jumpTo(n);
                }}
                aria-label="単元にジャンプ"
              >
                <option value="">単元にジャンプ…</option>
                {unitJumps.map((u, i) => (
                  <option key={i} value={u.start}>
                    {u.name}（p.{u.start} 付近）
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* ページ描画エリア (余白ギリギリまで削る) */}
          <div
            ref={viewerRef}
            className="min-h-0 flex-1 overflow-auto bg-neutral-100 p-0"
          >
            {!loaded ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>PDF を読み込んでいます…</span>
              </div>
            ) : (
              // 見開き全体が画面の高さに収まるように、各ページは高さフィット
              // (本を開いた見た目。縦スクロール不要でバランス良く)
              <div className="flex min-h-full w-full items-center justify-center gap-0">
                {pagesToShow.map((pn, i) => {
                  // ガイド読書中: 今のブロックがこのページにあれば青枠を重ねる。
                  // 枠は AI 推定 (block.bbox) だがズレるので、子が直接ドラッグで動かす/
                  // サイズ変更できる。調整はそのまま block.bbox に焼き込み DB へ永続化。
                  const cur = guidedBlocks?.[guidedIndex];
                  const displayBbox = cur?.bbox;
                  const showBox = !!cur && !!displayBbox && cur.pdfPage === pn;
                  return (
                    <div
                      key={pn}
                      className={`relative block shrink-0 ${guidedBlocks ? "cursor-pointer" : ""}`}
                      onClick={
                        guidedBlocks ? (e) => handlePageClick(pn, e) : undefined
                      }
                      title={guidedBlocks ? "読みたい所をタップすると、そこを説明するよ" : undefined}
                    >
                      <canvas
                        ref={(el) => {
                          canvasRefs.current[i] = el;
                        }}
                        className="block bg-white"
                      />
                      {showBox && displayBbox && (
                        <EditableHighlight
                          bbox={displayBbox}
                          onChange={editGuidedBbox}
                          onCommit={commitGuidedBbox}
                          onDragStart={(orig) => {
                            preDragBboxRef.current = orig;
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* レジュメモード時: 教材の横にレジュメ書く欄 (R6、左右並び)。葵 chat はさらに右。
            見開きはレジュメモード中は禁止 (pagesToShow で単一ページ強制)。 */}
        {resumeMode && (
          <>
            <ResizablePanel
              id="resume-write"
              defaultSize="36%"
              minSize="22%"
              className="min-w-0"
            >
              <ResumePane
                conceptName={
                  gateSegment?.conceptName ?? gateConcept?.name ?? "この論点"
                }
                segment={gateSegment}
                materialId={material.id}
                materialName={material.name}
                subjectId={material.subjectId}
                subjectName={subject?.name ?? "教科"}
                gradeLevel={material.gradeLevel ?? "中2"}
                pageImagesPacked={gatePacked}
                sourcePageRange={
                  gateSegment?.printPageHint ??
                  gateConcept?.pageRange ??
                  (page ? `p.${page}` : undefined)
                }
                existingEntry={
                  gateSegment
                    ? noteEntries?.find(
                        (e) =>
                          e.sourceSegmentId === gateSegment.id &&
                          e.sourceMaterialId === material.id &&
                          !e.deletedAt,
                      )
                    : undefined
                }
                studyLevel={
                  gateSegment &&
                  noteEntries?.some(
                    (e) =>
                      e.sourceSegmentId === gateSegment.id &&
                      e.sourceMaterialId === material.id &&
                      !e.deletedAt,
                  )
                    ? 1
                    : 0
                }
                subjectResumes={
                  resumes?.filter(
                    (r) => r.subjectId === material.subjectId && !r.deletedAt,
                  ) ?? []
                }
                onAddResume={onAddResume}
                onCommitted={(entry) => onNoteAdded?.(entry)}
                onClose={() => setResumeMode(false)}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        {/* 葵 chat */}
        <ResizablePanel
          id="chat"
          defaultSize={isMobile ? "42%" : "30%"}
          minSize="18%"
          className="min-w-0"
        >
        <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-sky-50/60 to-background">
          {/* 先生ヘッダー */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 py-2 backdrop-blur">
            <SubjectTeacherAvatar
              subjectId={teacherSubjectId}
              size={30}
              fallbackLetter={teacherAvatarLetter}
              className="ring-2 ring-sky-100"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">{teacherName}</span>
              <span className="text-[10px] text-muted-foreground">
                一緒に読みながら教えるよ
              </span>
            </div>
          </div>
          {/* 入口: まとまり一覧から選ぶ (M6/M7)。まとまり未生成の本は今ページから開始の保険。
              宿題モード (2026-06-11): 「一緒に解く」開始 + 締めの 2 ボタンに置き換え。 */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-3 py-1.5">
            {assignmentMode ? (
              <>
                {!guidedBlocks ? (
                  <Button
                    size="sm"
                    onClick={() => void startAssignment()}
                    disabled={!loaded || sending || guidedBusy}
                    className="gap-1.5"
                    title="紙で解いた宿題を、葵先生が 1 問ずつ解説するよ。"
                  >
                    {guidedBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    <span>一緒に解く</span>
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void finishAssignment(false)}
                      disabled={!loaded || sending || guidedBusy}
                      className="gap-1.5"
                      title="今日はここで中断する (つまずきは課題にしておくよ)"
                    >
                      <span>今日はここまで</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void finishAssignment(true)}
                      disabled={!loaded || sending || guidedBusy}
                      className="gap-1.5"
                      title="宿題ぜんぶ終わり! 「やった」にするよ"
                    >
                      <CircleCheck className="size-4" />
                      <span>ぜんぶ解けた!</span>
                    </Button>
                  </>
                )}
                {material.dueDate && (
                  <span className="ml-auto truncate rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {material.assignmentType === "test" ? "テスト日" : "提出日"}:{" "}
                    {material.dueDate.slice(5).replace("-", "/")}
                  </span>
                )}
              </>
            ) : contentSegments.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowUnitMenu(true)}
                disabled={!loaded || starting || sending || guidedBusy}
                className="gap-1.5"
                title="まとまり(単元)の一覧から、勉強する所を選べるよ。"
              >
                {starting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ListChecks className="size-4" />
                )}
                <span>まとまりを選ぶ</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void runOrientation(null)}
                disabled={!loaded || starting || sending || guidedBusy}
                className="gap-1.5"
                title="葵先生が今のページを説明してくれるよ。"
              >
                {starting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                <span>学習を開始する</span>
              </Button>
            )}
            {/* 区切りは裏で生成中。画面は塞がず、出来たら「まとまりを選ぶ」が出る。 */}
            {segmenting && contentSegments.length === 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                単元一覧を準備中…
              </span>
            )}
            {!assignmentMode && (
              <Button
                size="sm"
                onClick={() => void openResume()}
                disabled={!loaded || preparingGate || guidedBusy || resumeMode}
                className="gap-1.5"
                title="教科書を閉じて、自分の言葉でレジュメにするよ。"
              >
                {preparingGate ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <NotebookPen className="size-4" />
                )}
                <span>レジュメにする</span>
              </Button>
            )}
            {currentSegment && (
              <span
                className="ml-auto truncate rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                title="今読んでいる まとまり (一単元)"
              >
                今のまとまり: {currentSegment.conceptName}
              </span>
            )}
          </div>
          {/* 「選択した段階」(2026-06-08): まとまりを選んで一旦止まっている時だけ表示。
              子が「ここから読む」を押して初めてガイド読書 (青枠+解説) が始まる。 */}
          {pendingSegment && !guidedBlocks && !showUnitMenu && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-sky-50/60 px-3 py-1.5">
              <Button
                size="sm"
                onClick={beginGuided}
                disabled={!loaded || starting || sending || guidedBusy}
                className="gap-1.5"
                title="このまとまりを葵先生と一緒に読み始めるよ。"
              >
                {guidedBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                <span>ここから読む</span>
              </Button>
              <span className="text-[11px] text-muted-foreground">
                準備ができたら押してね（先にめくって眺めてもOK）
              </span>
            </div>
          )}
          {/* ガイド読書コントロール (G-A): まとまりを一区切りずつ歩いている間だけ表示。
              子は受け身で「次へ / もっと簡単に / もっと詳しく」+ 下の入力欄で質問。 */}
          {guidedBlocks && !showUnitMenu && (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-sky-50/60 px-3 py-1.5">
              {/* 前/次 = 読む所を「選ぶ」だけ (青枠が動く、まだ読まない)。順序を手動調整できる。 */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => moveCursor(guidedIndex - 1)}
                disabled={!loaded || guidedBusy || sending || guidedIndex <= 0}
                className="gap-1 px-2"
                title="前の区切りを選ぶ (まだ読まない)"
              >
                <ChevronLeft className="size-4" />
                <span>前</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => moveCursor(guidedIndex + 1)}
                disabled={
                  !loaded || guidedBusy || sending || guidedIndex >= guidedBlocks.length - 1
                }
                className="gap-1 px-2"
                title="次の区切りを選ぶ (まだ読まない)"
              >
                <span>次</span>
                <ChevronRight className="size-4" />
              </Button>
              {/* ここを解説 = 選んだ所を初めて葵が読む (主ボタン)。宿題は「この問題を解説」。 */}
              <Button
                size="sm"
                onClick={() => void explainCursor()}
                disabled={!loaded || guidedBusy || sending}
                className="gap-1.5"
                title={
                  assignmentMode
                    ? "選んでいる問題を葵に解説してもらう"
                    : "選んでいる所を葵に説明してもらう"
                }
              >
                {guidedBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                <span>{assignmentMode ? "この問題を解説" : "ここを解説"}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void adjustGuidedLevel(-1)}
                disabled={!loaded || guidedBusy || sending}
                className="px-2"
                title="今の説明をもっとやさしく言い直す"
              >
                やさしく
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void adjustGuidedLevel(1)}
                disabled={!loaded || guidedBusy || sending}
                className="px-2"
                title="今の説明をもっと詳しく言い直す"
              >
                詳しく
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {assignmentMode ? "問題 " : ""}
                {guidedIndex + 1} / {guidedBlocks.length}
              </span>
            </div>
          )}
          <div
            ref={chatScrollRef}
            className="min-h-0 flex-1 overflow-y-auto p-3"
          >
            {showUnitMenu && contentSegments.length > 0 ? (
              /* 入口: 全まとまり (グルーピング) を見せて「どこからやる?」と選ばせる */
              <div className="flex flex-col gap-3">
                <div className="flex items-end gap-2">
                  <SubjectTeacherAvatar
                    subjectId={teacherSubjectId}
                    size={28}
                    fallbackLetter={teacherAvatarLetter}
                    className="shrink-0 shadow-sm ring-2 ring-white"
                  />
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2 text-sm text-card-foreground shadow-sm">
                    この本はこんな「まとまり」に分けたよ📚
                    <br />
                    どこから勉強する? 押すと、そのまとまりを開くよ（始める準備）。
                  </div>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {contentSegments.map((seg) => {
                    const noted = !!notedSegmentIds?.has(seg.id);
                    return (
                      <li key={seg.id}>
                        <button
                          type="button"
                          onClick={() => selectUnit(seg)}
                          disabled={starting || sending}
                          className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
                        >
                          {noted ? (
                            <Check className="size-4 shrink-0 text-emerald-600" />
                          ) : (
                            <span className="size-4 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {seg.conceptName}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            p.{seg.startPdfPage}–{seg.endPdfPage}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="px-1 text-[11px] text-muted-foreground">
                  ✓ は、もうレジュメにした まとまりだよ。
                </p>
              </div>
            ) : history.length === 0 && (starting || guidedBusy) ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>葵先生が準備しているよ…</span>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-3 py-8 text-center">
                <SubjectTeacherAvatar
                  subjectId={teacherSubjectId}
                  size={56}
                  fallbackLetter={teacherAvatarLetter}
                  className="shadow-sm ring-2 ring-sky-100"
                />
                <div className="max-w-[260px] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
                  こんにちは、{teacherName}だよ{assignmentMode ? "✏️" : "📖"}
                  <br />
                  {assignmentMode ? (
                    <>
                      紙で解いた宿題を、1 問ずつ一緒に確認していこう。
                      <br />
                      <span className="font-medium text-primary">
                        ▶ 一緒に解く
                      </span>{" "}
                      を押すと、わたしが問題ごとに解説するよ。
                    </>
                  ) : segmenting ? (
                    <>
                      今、本を読んで単元一覧を準備中だよ（少し待ってね）。
                      <br />
                      待つ間も{" "}
                      <span className="font-medium text-primary">
                        ▶ 学習を開始する
                      </span>{" "}
                      で今のページから読み始められるよ。
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-primary">
                        ▶ 学習を開始する
                      </span>{" "}
                      を押すと、今のページから一緒に読むよ。分からない所は何でも聞いてね。
                    </>
                  )}
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {history.map((m, i) =>
                  m.role === "user" ? (
                    <li key={i} className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm">
                        {m.text}
                      </div>
                    </li>
                  ) : (
                    <li key={i} className="flex items-end gap-2">
                      <SubjectTeacherAvatar
                        subjectId={teacherSubjectId}
                        size={28}
                        fallbackLetter={teacherAvatarLetter}
                        className="shrink-0 shadow-sm ring-2 ring-white"
                      />
                      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2 text-sm text-card-foreground shadow-sm">
                        <MarkdownText text={m.text} />
                      </div>
                    </li>
                  ),
                )}
                {(sending || guidedBusy) && (
                  <li className="flex items-end gap-2">
                    <SubjectTeacherAvatar
                      subjectId={teacherSubjectId}
                      size={28}
                      fallbackLetter={teacherAvatarLetter}
                      className="shrink-0 shadow-sm ring-2 ring-white"
                    />
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-3 shadow-sm">
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
                    </div>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* 入力欄 */}
          <div className="flex shrink-0 items-end gap-2 border-t border-border p-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={
                speech.listening
                  ? "聞いているよ…🎤 (話した言葉が入るよ)"
                  : assignmentMode
                    ? "今の問題について聞く（Ctrl+Enter で送信）"
                    : "今のページについて聞く（Ctrl+Enter で送信）"
              }
              className="max-h-32 min-h-[44px] flex-1 resize-none"
              disabled={sending || guidedBusy}
            />
            {speech.supported && (
              <Button
                size="icon"
                variant={speech.listening ? "default" : "outline"}
                onClick={() =>
                  speech.listening
                    ? speech.stop()
                    : speech.start((text) =>
                        setDraft((d) => (d ? d + text : text)),
                      )
                }
                disabled={sending || guidedBusy}
                aria-label={speech.listening ? "音声入力を止める" : "音声で話す"}
                title={speech.listening ? "音声入力を止める" : "音声で話す"}
              >
                {speech.listening ? (
                  <MicOff className="size-4" />
                ) : (
                  <Mic className="size-4" />
                )}
              </Button>
            )}
            <Button
              size="icon"
              onClick={() => void handleSend()}
              disabled={sending || guidedBusy || draft.trim().length === 0}
              aria-label="送信"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
