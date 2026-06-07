"use client";

/**
 * PageThumbnailRail — 読書ビュー左端の縦スライダー (まとめノート M5、2026-06-06)
 *
 * grill 確定 M5: 全ページのサムネを縦に並べ、「今のまとまり(一単元)」の範囲を色で示し、
 * 本全体のどこ・どこまでやったか (ノート化済み) を一目で見せる「見る地図」。**編集不可**
 * (区切りは AI 確定、子はドラッグも数値も触らない M2)。クリックでそのページへジャンプ
 * (ナビゲーションは可)。
 *
 * 性能: 50〜349 ページでも重くならないよう IntersectionObserver で**画面に入った
 * サムネだけ遅延描画**する。各ページは別 canvas なので描画競合は起きない
 * (renderPageToCanvas の cancel-token もそのまま効く)。
 */

import { useCallback, useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPageToCanvas } from "@/lib/admin/pdf-extract-text";
import { findSegmentForPage } from "@/lib/notes/concept-for-page";
import type { ConceptSegment } from "@/lib/learn/types";
import { Check } from "lucide-react";

type Props = {
  doc: PDFDocumentProxy | null;
  numPages: number;
  currentPage: number;
  segments?: ConceptSegment[];
  /** 今読んでいるまとまり (ハイライト対象) */
  currentSegmentId?: string | null;
  /** ノート化済みの まとまり ID (緑チェック) */
  notedSegmentIds?: Set<string>;
  onJump: (page: number) => void;
};

const THUMB_WIDTH = 84; // px (CSS 論理幅)

export function PageThumbnailRail({
  doc,
  numPages,
  currentPage,
  segments,
  currentSegmentId,
  notedSegmentIds,
  onJump,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderedRef = useRef<Set<number>>(new Set());

  // IntersectionObserver: 画面に入ったページだけ描画 (遅延)。
  // doc / ページ数が変わったら描画済みをリセットして再描画させる。
  useEffect(() => {
    if (!doc || !scrollRef.current) return;
    renderedRef.current = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.idx);
          if (Number.isNaN(idx) || renderedRef.current.has(idx)) continue;
          const canvas = canvasRefs.current[idx];
          if (!canvas) continue;
          renderedRef.current.add(idx);
          // ページ番号は 1-indexed
          renderPageToCanvas(doc, idx + 1, canvas, THUMB_WIDTH).catch(() => {
            renderedRef.current.delete(idx); // 失敗は次回再試行
          });
        }
      },
      { root: scrollRef.current, rootMargin: "300px 0px" },
    );
    for (const el of slotRefs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [doc, numPages]);

  // 現在ページを可視域へスクロール
  useEffect(() => {
    const el = slotRefs.current[currentPage - 1];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [currentPage]);

  // キーボード操作 (ユーザー要望): レールにフォーカスがある時、上下キーでページ移動。
  // ↑/← = 前ページ、↓/→ = 次ページ、PageUp/Down = ±5、Home/End = 先頭/末尾。
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (numPages <= 0) return;
      let next: number | null = null;
      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
          next = currentPage + 1;
          break;
        case "ArrowUp":
        case "ArrowLeft":
          next = currentPage - 1;
          break;
        case "PageDown":
          next = currentPage + 5;
          break;
        case "PageUp":
          next = currentPage - 5;
          break;
        case "Home":
          next = 1;
          break;
        case "End":
          next = numPages;
          break;
        default:
          return;
      }
      e.preventDefault();
      onJump(Math.min(Math.max(1, next), numPages));
    },
    [currentPage, numPages, onJump],
  );

  const renderSlot = useCallback(
    (i: number) => {
      const pageNum = i + 1;
      const seg = findSegmentForPage(pageNum, segments);
      const isCurrentSeg = !!seg && seg.id === currentSegmentId;
      const isNoted = !!seg && !!notedSegmentIds?.has(seg.id);
      const isCurrentPage = pageNum === currentPage;
      const isSegStart = !!seg && seg.startPdfPage === pageNum;

      return (
        <button
          key={pageNum}
          type="button"
          data-idx={i}
          ref={(el) => {
            slotRefs.current[i] = el;
          }}
          onClick={() => onJump(pageNum)}
          title={seg ? `p.${pageNum}・${seg.conceptName}` : `p.${pageNum}`}
          className={[
            "group relative flex w-full flex-col items-center gap-0.5 rounded-md border px-1 py-1 text-left transition-colors",
            isCurrentSeg
              ? "border-primary/60 bg-primary/10"
              : "border-transparent hover:bg-muted/60",
            isCurrentPage ? "ring-2 ring-sky-500" : "",
          ].join(" ")}
        >
          {/* まとまりの先頭にラベル (ここから新しい単元、の目印) */}
          {isSegStart && seg && (
            <span
              className="flex w-full items-center gap-1 truncate rounded-sm bg-primary/15 px-1 py-0.5 text-[9px] font-medium text-primary"
              title={seg.conceptName}
            >
              {isNoted && <Check className="size-2.5 shrink-0 text-emerald-600" />}
              <span className="truncate">{seg.conceptName}</span>
            </span>
          )}
          <canvas
            ref={(el) => {
              canvasRefs.current[i] = el;
            }}
            className="block w-full rounded-sm border border-border bg-white shadow-sm"
            style={{ width: THUMB_WIDTH }}
          />
          <span
            className={[
              "text-[10px]",
              isCurrentPage
                ? "font-bold text-sky-600"
                : isCurrentSeg
                  ? "text-primary"
                  : "text-muted-foreground",
            ].join(" ")}
          >
            {pageNum}
          </span>
        </button>
      );
    },
    [segments, currentSegmentId, notedSegmentIds, currentPage, onJump],
  );

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-muted/20">
      <div className="shrink-0 border-b border-border px-2 py-1.5 text-center text-[10px] font-medium text-muted-foreground">
        全 {numPages || "…"} ページ
        <span className="mt-0.5 block text-[9px] font-normal text-muted-foreground/70">
          ↑↓ で移動
        </span>
      </div>
      <div
        ref={scrollRef}
        tabIndex={0}
        role="listbox"
        aria-label="ページ一覧（上下キーで移動）"
        onKeyDown={handleKeyDown}
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
      >
        {numPages > 0 ? (
          Array.from({ length: numPages }, (_, i) => renderSlot(i))
        ) : (
          <div className="px-2 py-4 text-center text-[10px] text-muted-foreground">
            読み込み中…
          </div>
        )}
      </div>
    </div>
  );
}
