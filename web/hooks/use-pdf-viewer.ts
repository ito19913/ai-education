"use client";

/**
 * usePdfViewer — 読書ビューの PDF ビューア中核フック
 * (Phase 3 モノリス分割、2026-06-13: MaterialReadPane から移設、挙動同一)
 *
 * 担当 = PDF ロード (L1 キャッシュ → Storage 復元) / ページ state / 見開き / ズーム /
 * フィット描画 / リサイズ追従 / ページ移動 (前・次・ジャンプ)。
 * まとまり・ガイド読書・chat 等のモード固有ロジックは持たない。
 *
 * - PDF はセッション中だけ in-memory 保持 (session-pdf-store)。リロード後は Storage の
 *   pdfPath から DL して復元 (段階1-B)。どちらも無ければ loadError="no-file"。
 * - forceSingle=true (レジュメモード R6) の間は見開き設定に関わらず単一ページに強制。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadPdfDocument,
  renderPageToCanvas,
  type LoadedPdf,
} from "@/lib/pdf/pdf-extract-text";
import { getSessionPdf, setSessionPdf } from "@/lib/pdf/session-pdf-store";
import { downloadMaterialPdf } from "@/lib/materials/pdf-storage";

export function usePdfViewer({
  materialId,
  pdfPath,
  initialPage,
  forceSingle,
}: {
  materialId: string;
  pdfPath?: string;
  initialPage?: number;
  /** true の間は見開き設定に関わらず単一ページ表示 (レジュメモード R6)。 */
  forceSingle: boolean;
}) {
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
  // forceSingle (レジュメモード) 中は横にレジュメ pane を置くため単一ページに強制 (R6)。
  const pagesToShow = useMemo(() => {
    if (forceSingle || !spread) return [page];
    const arr = [page];
    if (page + 1 <= (numPages || page + 1)) arr.push(page + 1);
    return arr;
  }, [forceSingle, spread, page, numPages]);

  // めくり幅 (見開きは2ページ進む)
  const step = spread ? 2 : 1;

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
    const cached = getSessionPdf(materialId);
    if (cached) {
      loadFromFile(cached);
    } else if (pdfPath) {
      // Storage から復元 (リロード後)。
      setDownloading(true);
      downloadMaterialPdf(pdfPath)
        .then((file) => {
          if (cancelled) return;
          setSessionPdf(materialId, file); // 次回・他ページのため L1 にキャッシュ
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
  }, [materialId, pdfPath]);

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

  const goPrev = useCallback(() => setPage((p) => Math.max(1, p - step)), [step]);
  const goNext = useCallback(
    () => setPage((p) => Math.min(numPages || p, p + step)),
    [numPages, step],
  );
  const jumpTo = useCallback(
    (n: number) => setPage(Math.min(Math.max(1, n), numPages || n)),
    [numPages],
  );

  return {
    loaded,
    numPages,
    page,
    setPage,
    pageInput,
    setPageInput,
    loadError,
    downloading,
    spread,
    setSpread,
    zoom,
    setZoom,
    pagesToShow,
    step,
    canvasRefs,
    viewerRef,
    goPrev,
    goNext,
    jumpTo,
  };
}
