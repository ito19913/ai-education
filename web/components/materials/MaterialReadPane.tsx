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
} from "lucide-react";
import {
  loadPdfDocument,
  renderPageToCanvas,
  renderPageToJpeg,
  extractFullPageTexts,
  type LoadedPdf,
} from "@/lib/admin/pdf-extract-text";
import { segmentConceptsFromText } from "@/lib/admin/segment-claude";
import { getSessionPdf, setSessionPdf } from "@/lib/admin/session-pdf-store";
import { downloadMaterialPdf } from "@/lib/materials/pdf-storage";
import { updateMaterialSegments } from "@/lib/materials/materials-repo";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import {
  respondViaAokiChat,
  type AokiChatMessage,
} from "@/lib/admin/aoki-chat-claude";
import { NoteGateDialog } from "@/components/notes/NoteGateDialog";
import { PageThumbnailRail } from "@/components/materials/PageThumbnailRail";
import {
  findConceptForPage,
  findSegmentForPage,
  segmentPages,
} from "@/lib/notes/concept-for-page";
import { SubjectTeacherAvatar } from "@/components/ui/subject-teacher-avatar";
import { MarkdownText } from "@/components/chat/MarkdownText";
import { NotebookPen, Play, ListChecks, Check } from "lucide-react";
import type {
  AiExtractedNode,
  ConceptSegment,
  Material,
  NoteEntry,
  Subject,
} from "@/lib/learn/types";

type Props = {
  material: Material;
  subject: Subject | null;
  /** 体系図ノードから開いた時の初期ページ (印刷ページ番号≒物理ページの近傍、v1) */
  initialPage?: number;
  onBack: () => void;
  /** まとめノート N9①: 能動ゲート通過でエントリを刻んだ時に親へ通知 */
  onNoteAdded?: (entry: NoteEntry) => void;
  /** 既にノート化済みの まとまり ID 集合 (M7: 次の未まとめ単元の提示に使う) */
  notedSegmentIds?: Set<string>;
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

export function MaterialReadPane({
  material,
  subject,
  initialPage,
  onBack,
  onNoteAdded,
  notedSegmentIds,
}: Props) {
  const [loaded, setLoaded] = useState<LoadedPdf | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(initialPage && initialPage > 0 ? initialPage : 1);
  const [pageInput, setPageInput] = useState(String(page));
  const [loadError, setLoadError] = useState<"no-file" | "load-fail" | null>(null);
  // 段階1-B: session-pdf-store に無く Storage から DL 中 (リロード後の復元)。
  const [downloading, setDownloading] = useState(false);
  // 見開き (2ページ表示) ⇄ 単ページ。default = 見開き (ユーザー要望)。
  const [spread, setSpread] = useState(true);
  // ズーム倍率。1 = エリアにフィット、>1 で拡大 (スクロール)。
  const [zoom, setZoom] = useState(1);
  // ページの縦横比 (width / height)。フィット計算に使う。
  const [pageAspect, setPageAspect] = useState(0.707); // A 判の縦置き目安、ロード後に実測で上書き
  // リサイズで再フィットさせるためのトリガ
  const [resizeTick, setResizeTick] = useState(0);

  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const viewerRef = useRef<HTMLDivElement>(null);

  // 今表示するページ番号 (見開きなら [page, page+1]、末尾なら片ページ)
  const pagesToShow = useMemo(() => {
    if (!spread) return [page];
    const arr = [page];
    if (page + 1 <= (numPages || page + 1)) arr.push(page + 1);
    return arr;
  }, [spread, page, numPages]);

  // めくり幅 (見開きは2ページ進む)
  const step = spread ? 2 : 1;

  // 葵 chat (MaterialDetailView の実装を踏襲)
  const [history, setHistory] = useState<AokiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

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
  useEffect(() => {
    const hasPersisted =
      !!material.conceptSegments && material.conceptSegments.length > 0;
    if (hasPersisted || !loaded) return;

    const cached = sessionSegmentCache.get(material.id);
    if (cached) {
      if (!localSegments) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalSegments(cached);
      }
      return;
    }
    if (localSegments || segmenting) return;

    const file = getSessionPdf(material.id);
    if (!file) return;

    let cancelled = false;
    setSegmenting(true);
    (async () => {
      try {
        const { hasTextLayer, packedText } = await extractFullPageTexts(file);
        if (cancelled) return;
        if (!hasTextLayer || packedText.length === 0) {
          setSegmenting(false);
          return;
        }
        const segs = await segmentConceptsFromText({
          materialName: material.name,
          subjectName: subject?.name ?? "教科",
          gradeLevel: material.gradeLevel ?? "中2",
          packedText,
        });
        if (cancelled) return;
        if (segs.length > 0) {
          sessionSegmentCache.set(material.id, segs);
          setLocalSegments(segs);
          // real モードなら DB に保存 → 次回開いた時は即表示 (再生成不要)。
          if (isSupabaseConfigured()) {
            updateMaterialSegments(material.id, segs).catch((e) =>
              console.error("[読書] まとまり保存失敗:", e),
            );
          }
        }
      } catch (err) {
        console.error("[読書] まとまり生成失敗:", err);
      } finally {
        if (!cancelled) setSegmenting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loaded,
    material.id,
    material.conceptSegments,
    material.name,
    material.gradeLevel,
    subject,
    localSegments,
    segmenting,
  ]);

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

  // ----- まとめノート N9①: 能動ゲート起動 -----
  const [gateOpen, setGateOpen] = useState(false);
  const [gatePacked, setGatePacked] = useState("");
  const [gateConcept, setGateConcept] = useState<AiExtractedNode | null>(null);
  const [gateSegment, setGateSegment] = useState<ConceptSegment | null>(null);
  const [preparingGate, setPreparingGate] = useState(false);
  // フロー再設計: 学習セッション開始 (葵が今のページを自分から説明する)
  const [starting, setStarting] = useState(false);

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
4) 最後に「まずは一度ざっと通して読んでみよう。分からない所は飛ばして大丈夫。読み終えて『ノートにまとめる』を押したら、概念ごとに一緒にまとめていこうね。ここから始めていい?」と通読を促し、軽く確認する。`
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

  // 入口の一覧から まとまり を選んだ時: 一覧を閉じてその単元のオリエンを開始。
  const startUnit = useCallback(
    (seg: ConceptSegment) => {
      setShowUnitMenu(false);
      void runOrientation(seg);
    },
    [runOrientation],
  );

  // M8: まとめる = まとまり (一単元) 全体を vision で渡して 1 概念の要約を作る。
  // まとまりが無ければ従来通り今表示ページだけ (フォールバック)。
  const openNoteGate = useCallback(async () => {
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
      setGateOpen(true);
    } catch (err) {
      console.error("[読書] ノートゲート準備失敗:", err);
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
        <span className="ml-auto text-xs text-muted-foreground">
          葵先生と一緒に読む
        </span>
      </div>

      {/* 本体: 広い画面=左右、狭い画面=上下スタック */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* 左端の縦スライダー (全ページサムネ + まとまり色分け、見る地図、M5) */}
        <PageThumbnailRail
          doc={loaded?.doc ?? null}
          numPages={numPages}
          currentPage={page}
          segments={segments}
          currentSegmentId={currentSegment?.id ?? null}
          notedSegmentIds={notedSegmentIds}
          onJump={jumpTo}
        />

        {/* PDF ビューア */}
        <div className="flex min-h-0 flex-1 flex-col border-b border-border lg:border-b-0 lg:border-r">
          {/* ページコントロール */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-2 py-1">
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
                {pagesToShow.map((pn, i) => (
                  <canvas
                    key={pn}
                    ref={(el) => {
                      canvasRefs.current[i] = el;
                    }}
                    className="block shrink-0 bg-white"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 葵 chat */}
        <div className="flex min-h-0 flex-col bg-gradient-to-b from-sky-50/60 to-background lg:w-[34%] lg:min-w-[360px] lg:max-w-[560px] lg:shrink-0">
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
          {/* 入口: まとまり一覧から選ぶ (M6/M7)。まとまり未生成の本は今ページから開始の保険。 */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-3 py-1.5">
            {segmenting && contentSegments.length === 0 ? (
              <Button size="sm" variant="outline" disabled className="gap-1.5">
                <Loader2 className="size-4 animate-spin" />
                <span>まとまりを準備中…</span>
              </Button>
            ) : contentSegments.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowUnitMenu(true)}
                disabled={!loaded || starting || sending}
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
                disabled={!loaded || starting || sending}
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
            <Button
              size="sm"
              onClick={() => void openNoteGate()}
              disabled={!loaded || preparingGate}
              className="gap-1.5"
              title="今のページと葵との対話から、自分のノートに刻むよ。"
            >
              {preparingGate ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <NotebookPen className="size-4" />
              )}
              <span>ノートにまとめる</span>
            </Button>
            {currentSegment && (
              <span
                className="ml-auto truncate rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                title="今読んでいる まとまり (一単元)"
              >
                今のまとまり: {currentSegment.conceptName}
              </span>
            )}
          </div>
          <div
            ref={chatScrollRef}
            className="min-h-0 flex-1 overflow-y-auto p-3"
          >
            {segmenting && contentSegments.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-3 py-10 text-center">
                <Loader2 className="size-5 animate-spin text-primary" />
                <div className="max-w-[260px] text-sm text-muted-foreground">
                  葵先生が本全体を読んで、
                  <br />
                  「まとまり (単元)」に区切っているよ…
                  <br />
                  <span className="text-xs">（初回だけ少し待ってね）</span>
                </div>
              </div>
            ) : showUnitMenu && contentSegments.length > 0 ? (
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
                    どこから勉強する? 押すと、そのページを開いて一緒に始めるよ。
                  </div>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {contentSegments.map((seg) => {
                    const noted = !!notedSegmentIds?.has(seg.id);
                    return (
                      <li key={seg.id}>
                        <button
                          type="button"
                          onClick={() => startUnit(seg)}
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
                  ✓ は、もうノートにまとめた まとまりだよ。
                </p>
              </div>
            ) : history.length === 0 && starting ? (
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
                  こんにちは、{teacherName}だよ📖
                  <br />
                  まだ「まとまり」が準備できていないみたい。
                  <br />
                  <span className="font-medium text-primary">
                    ▶ 学習を開始する
                  </span>{" "}
                  で今のページから始めることもできるよ。
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
                {sending && (
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
              placeholder="今のページについて聞く（Ctrl+Enter で送信）"
              className="max-h-32 min-h-[44px] flex-1 resize-none"
              disabled={sending}
            />
            <Button
              size="icon"
              onClick={() => void handleSend()}
              disabled={sending || draft.trim().length === 0}
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
      </div>

      {/* まとめノート N9①: 能動ゲートダイアログ */}
      <NoteGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        mode="create"
        materialId={material.id}
        materialName={material.name}
        subjectId={material.subjectId}
        subjectName={subject?.name ?? "教科"}
        gradeLevel={material.gradeLevel ?? "中2"}
        pageNumber={page}
        pageImagesPacked={gatePacked}
        currentConcept={gateConcept}
        segment={gateSegment}
        dialogue={history}
        onCommitted={(entry) => {
          onNoteAdded?.(entry);
        }}
      />
    </div>
  );
}
