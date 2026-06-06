/**
 * 論点認定 最小ユーティリティ (まとめノート N9① MVP、2026-06-05)
 *
 * grill N5: 「学びの断片 → どの概念か を判定する論点認定がエンジンの土台」。
 * MVP では、読書ビューの現在ページが教材体系図 (extractedNodes) のどの概念の
 * ページ範囲に入るかで概念を当てる最小実装。一致しなければ null (その場合は
 * note-gate の AI が画像から概念名を付ける)。
 */
import type { AiExtractedNode, ConceptSegment } from "@/lib/learn/types";

/** "p.42-58" / "p.24-" / "p.42" から [start, end] を取り出す。取れなければ null。 */
export function parsePageRange(
  pageRange?: string,
): { start: number; end: number } | null {
  if (!pageRange) return null;
  const m = pageRange.match(/p\.?\s*(\d+)(?:\s*[-–~]\s*(\d+))?/i);
  if (!m) return null;
  const start = Number.parseInt(m[1], 10);
  const end = m[2] ? Number.parseInt(m[2], 10) : start;
  return { start, end: Math.max(start, end) };
}

/**
 * 現在ページ番号を含む概念ノードを返す。無ければ null。
 * 複数該当する場合は範囲が狭い (より具体的な) ものを優先。
 */
export function findConceptForPage(
  page: number,
  extractedNodes?: AiExtractedNode[],
): AiExtractedNode | null {
  if (!extractedNodes || extractedNodes.length === 0) return null;
  let best: AiExtractedNode | null = null;
  let bestSpan = Number.POSITIVE_INFINITY;
  for (const node of extractedNodes) {
    const range = parsePageRange(node.pageRange);
    if (!range) continue;
    if (page >= range.start && page <= range.end) {
      const span = range.end - range.start;
      if (span < bestSpan) {
        best = node;
        bestSpan = span;
      }
    }
  }
  return best;
}

// ============================================================================
// まとまり (一単元) 区切り版 (M1-M10、2026-06-06)
// ============================================================================
//
// ★旧 findConceptForPage との違い★
// 旧版は「読書ビューの物理ページ (PDF page index)」を AiExtractedNode.pageRange
// (= 本に印刷されたページ番号) と直接比較していた → 前付け/自炊スキャンでオフセットが
// あるとズレる潜在バグ。新版は ConceptSegment が **PDF 紙番号 (PDF page index) で
// 区切られている** (M3) ので、同じ土俵で比較でき、ズレない。読書ビューは今後こちらを使う。

/**
 * 現在の PDF ページ番号 (1-indexed) を含む まとまり (ConceptSegment) を返す。無ければ null。
 * 複数該当する場合は範囲が狭い (より具体的な) ものを優先 (M7)。
 */
export function findSegmentForPage(
  pdfPage: number,
  segments?: ConceptSegment[],
): ConceptSegment | null {
  if (!segments || segments.length === 0) return null;
  let best: ConceptSegment | null = null;
  let bestSpan = Number.POSITIVE_INFINITY;
  for (const seg of segments) {
    if (pdfPage >= seg.startPdfPage && pdfPage <= seg.endPdfPage) {
      const span = seg.endPdfPage - seg.startPdfPage;
      if (span < bestSpan) {
        best = seg;
        bestSpan = span;
      }
    }
  }
  return best;
}

/**
 * まだノート化されていない「次のまとまり」を返す (M7: ノート進捗で次を提示)。
 * notedSegmentIds = 既存ノートの sourceSegmentId 集合。先頭ページ順で最初の未刻みを返す。
 * 全部刻み済み / セグメント無しなら null。
 */
export function findNextUnnotedSegment(
  segments: ConceptSegment[] | undefined,
  notedSegmentIds: Set<string>,
): ConceptSegment | null {
  if (!segments || segments.length === 0) return null;
  const ordered = [...segments].sort((a, b) => a.startPdfPage - b.startPdfPage);
  return ordered.find((s) => !notedSegmentIds.has(s.id)) ?? null;
}

/** ConceptSegment の PDF ページ範囲を配列で返す ("通読"・範囲 vision 用)。 */
export function segmentPages(seg: ConceptSegment): number[] {
  const pages: number[] = [];
  for (let p = seg.startPdfPage; p <= seg.endPdfPage; p++) pages.push(p);
  return pages;
}
