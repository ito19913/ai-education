/**
 * 論点認定 最小ユーティリティ (まとめノート N9① MVP、2026-06-05)
 *
 * grill N5: 「学びの断片 → どの概念か を判定する論点認定がエンジンの土台」。
 * MVP では、読書ビューの現在ページが教材体系図 (extractedNodes) のどの概念の
 * ページ範囲に入るかで概念を当てる最小実装。一致しなければ null (その場合は
 * note-gate の AI が画像から概念名を付ける)。
 */
import type { AiExtractedNode } from "@/lib/learn/types";

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
