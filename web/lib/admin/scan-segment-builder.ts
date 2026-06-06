"use client";

/**
 * C-8: スキャン本 まとまり区切り オーケストレーター (クライアント、2026-06-06)
 *
 * pdf.js でのページ描画と segment-scan-claude.ts の Server Action 群を束ねて、
 * スキャン本 (文字レイヤー無し) から ConceptSegment[] を組み立てる。
 *
 *  (A) ハイブリッド経路 (目次あり): 体系図ノード (印刷ページ付き) を AI が 1 概念へ
 *      再グルーピング → オフセット 2 点較正 (印刷番号を vision で読む) → 印刷→PDF 紙番号
 *      変換。較正が一貫しなければ まとまりごと個別探索にフォールバック。
 *  (B) 全ページ vision 経路 (目次なし or A 失敗): 低解像度ページ画像を順に vision で
 *      読み、PDF 紙番号で直接区切る (オフセット問題なし)。
 *
 * 呼び出し元: components/materials/MaterialReadPane.tsx のオンデマンド生成エフェクト。
 */

import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPageToJpeg, renderPageToJpegAt } from "@/lib/admin/pdf-extract-text";
import {
  regroupTocIntoSegments,
  readPrintedPageNumbers,
  segmentScanByVision,
  type ScanVisionSegment,
} from "@/lib/admin/segment-scan-claude";
import { parsePageRange } from "@/lib/notes/concept-for-page";
import type { ConceptSegment, Material } from "@/lib/learn/types";

// ハイブリッドを試す最小の「印刷ページ付き目次ノード」数 (これ未満は vision 経路へ)。
const MIN_TOC_NODES_FOR_HYBRID = 3;
// オフセット較正: 先頭から読む高解像度ページ数 (前付け + 本文先頭で番号が出る所まで)。
const CALIB_HEAD_PAGES = 14;
// 較正の検証/個別探索で前後に見る窓 (±)。
const CALIB_WINDOW = 3;
// vision 経路: 1 回の vision 呼び出しに渡す連続ページ数。
const VISION_CHUNK_PAGES = 24;
// vision 経路の描画解像度 (構造検出には低解像度で十分、payload/コスト抑制)。
const VISION_LONG_EDGE = 1000;
const VISION_QUALITY = 0.6;
// vision 経路の処理ページ上限 (巨大本の暴走防止、超過分は log して打ち切り)。
const MAX_VISION_TOTAL_PAGES = 400;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** 配列の最頻値 (同数なら最初に到達したもの)。空なら null。 */
function mode(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const count = new Map<number, number>();
  let best = nums[0];
  let bestC = 0;
  for (const n of nums) {
    const c = (count.get(n) ?? 0) + 1;
    count.set(n, c);
    if (c > bestC) {
      bestC = c;
      best = n;
    }
  }
  return best;
}

/** 指定 PDF ページ群を高解像度で描画し、印刷番号 (ノンブル) を読む。{pdfPage,printed} を返す。 */
async function readNumbersForPages(
  doc: PDFDocumentProxy,
  pages: number[],
): Promise<Array<{ pdfPage: number; printed: number | null }>> {
  const rendered: { pdfPage: number; img: string }[] = [];
  for (const p of pages) {
    const img = await renderPageToJpeg(doc, p);
    if (img) rendered.push({ pdfPage: p, img });
  }
  if (rendered.length === 0) return [];
  const nums = await readPrintedPageNumbers(rendered.map((r) => r.img).join("\n"));
  return rendered.map((r, i) => ({ pdfPage: r.pdfPage, printed: nums[i] ?? null }));
}

/**
 * 印刷ページ→PDF 紙番号のオフセット N (pdfPage = printPage + N) を較正する。
 * 先頭ページの印刷番号から N を推定 (最頻値) し、遅い位置で再算出して一致を確認。
 * 一致すれば verified:true。番号が一切読めなければ null。
 */
async function calibrateOffset(
  doc: PDFDocumentProxy,
  lastPrintStart: number,
  numPages: number,
): Promise<{ offset: number; verified: boolean } | null> {
  const headCount = Math.min(CALIB_HEAD_PAGES, numPages);
  const headPages = Array.from({ length: headCount }, (_, i) => i + 1);
  const head = await readNumbersForPages(doc, headPages);
  const headOffsets = head
    .filter((h) => h.printed != null)
    .map((h) => h.pdfPage - (h.printed as number));
  const offset = mode(headOffsets);
  if (offset === null) return null;

  // 検証: 遅い位置の想定 PDF ページ周辺で印刷番号を読み、同じオフセットになるか。
  const expected = lastPrintStart + offset;
  if (expected >= 1 && expected <= numPages) {
    const win: number[] = [];
    for (let p = expected - CALIB_WINDOW; p <= expected + CALIB_WINDOW; p++) {
      if (p >= 1 && p <= numPages) win.push(p);
    }
    const got = await readNumbersForPages(doc, win);
    const winOffsets = got
      .filter((g) => g.printed != null)
      .map((g) => g.pdfPage - (g.printed as number));
    const verifyOffset = mode(winOffsets);
    if (verifyOffset !== null) {
      return { offset: verifyOffset === offset ? offset : verifyOffset, verified: verifyOffset === offset };
    }
  }
  // 検証ページで番号が読めなかった = 確証は無いが head 推定を rough として返す。
  return { offset, verified: false };
}

/** まとまり 1 件の開始 PDF ページを、rough オフセット中心の窓探索で個別に確定。 */
async function pinStartPdf(
  doc: PDFDocumentProxy,
  printStart: number,
  roughOffset: number,
  numPages: number,
): Promise<number> {
  const center = clamp(printStart + roughOffset, 1, numPages);
  const win: number[] = [];
  for (let p = center - CALIB_WINDOW; p <= center + CALIB_WINDOW; p++) {
    if (p >= 1 && p <= numPages) win.push(p);
  }
  const got = await readNumbersForPages(doc, win);
  const hit = got.find((g) => g.printed === printStart);
  return hit ? hit.pdfPage : center;
}

type GroupRange = {
  conceptName: string;
  printStart: number;
  printEnd: number;
  parentNodeTempId?: string;
};

/** ハイブリッド経路: 目次の体系図ノードを土台に ConceptSegment[] を組む。 */
async function buildViaHybrid(
  doc: PDFDocumentProxy,
  material: Material,
  subjectName: string,
  numPages: number,
): Promise<ConceptSegment[]> {
  const tocNodes = (material.extractedNodes ?? []).filter((n) =>
    parsePageRange(n.pageRange),
  );

  // 1) AI が 1 概念へ再グルーピング (ページ番号は出させない)。
  const groups = await regroupTocIntoSegments({
    materialName: material.name,
    subjectName,
    gradeLevel: material.gradeLevel ?? "中2",
    tocNodes: tocNodes.map((n) => ({
      tempId: n.tempId,
      name: n.name,
      pageRange: n.pageRange,
    })),
  });
  if (groups.length === 0) return [];

  // 2) 各グループの印刷ページ範囲をノードから決定的に算出。
  const rangeOf = new Map<string, { start: number; end: number }>();
  for (const n of tocNodes) {
    const r = parsePageRange(n.pageRange);
    if (r) rangeOf.set(n.tempId, r);
  }
  const gs: GroupRange[] = [];
  for (const g of groups) {
    const ranges = g.nodeTempIds
      .map((id) => rangeOf.get(id))
      .filter((r): r is { start: number; end: number } => !!r);
    if (ranges.length === 0) continue;
    gs.push({
      conceptName: g.conceptName,
      printStart: Math.min(...ranges.map((r) => r.start)),
      printEnd: Math.max(...ranges.map((r) => r.end)),
      parentNodeTempId: g.nodeTempIds[0],
    });
  }
  if (gs.length === 0) return [];
  gs.sort((a, b) => a.printStart - b.printStart);
  // 連続被覆: 各まとまりの end を次まとまりの start-1 まで延ばす (隙間/重なり解消)。
  for (let i = 0; i < gs.length - 1; i++) {
    gs[i].printEnd = Math.max(gs[i].printEnd, gs[i + 1].printStart - 1);
  }

  // 3) オフセット較正。
  const calib = await calibrateOffset(doc, gs[gs.length - 1].printStart, numPages);
  if (!calib) return []; // 印刷番号が全く読めない → 呼び出し側で vision 経路へ。

  const segs: ConceptSegment[] = [];
  let seq = 0;

  if (calib.verified) {
    // 全体共通オフセットを一括適用。
    for (const g of gs) {
      const startPdf = g.printStart + calib.offset;
      const endPdf = g.printEnd + calib.offset;
      if (startPdf > numPages || endPdf < 1) continue;
      seq += 1;
      segs.push(makeSegment(seq, g, clamp(startPdf, 1, numPages), clamp(endPdf, 1, numPages)));
    }
  } else {
    // 較正が一貫しない → まとまりごとに開始ページを個別探索 (rough オフセット中心)。
    const starts: number[] = [];
    for (const g of gs) {
      starts.push(await pinStartPdf(doc, g.printStart, calib.offset, numPages));
    }
    for (let i = 0; i < gs.length; i++) {
      const startPdf = starts[i];
      if (startPdf > numPages) continue;
      // 終端: 次まとまりがあればその開始-1。最後のまとまりは次が無いので、印刷ページ幅
      // ぶんだけ伸ばす (numPages まで伸ばすと本の残り全部を飲み込むバグになる)。
      const printSpan = Math.max(0, gs[i].printEnd - gs[i].printStart);
      const endPdf =
        i + 1 < gs.length
          ? Math.max(startPdf, starts[i + 1] - 1)
          : startPdf + printSpan;
      seq += 1;
      segs.push(makeSegment(seq, gs[i], startPdf, clamp(endPdf, startPdf, numPages)));
    }
  }

  return segs;
}

function makeSegment(
  seq: number,
  g: GroupRange,
  startPdfPage: number,
  endPdfPage: number,
): ConceptSegment {
  return {
    id: `seg-${seq}`,
    conceptName: g.conceptName,
    startPdfPage,
    endPdfPage: Math.max(endPdfPage, startPdfPage),
    parentNodeTempId: g.parentNodeTempId,
    source: "outline",
    printPageHint: `p.${g.printStart}-${g.printEnd}`,
  };
}

/** 全ページ vision 経路: 低解像度ページ画像を順に読み PDF 紙番号で区切る。 */
async function buildViaVision(
  doc: PDFDocumentProxy,
  material: Material,
  subjectName: string,
  numPages: number,
): Promise<ConceptSegment[]> {
  const cap = Math.min(numPages, MAX_VISION_TOTAL_PAGES);
  if (cap < numPages) {
    console.warn(
      `[C-8] vision 経路: ${numPages} ページ中、先頭 ${cap} ページのみ区切ります (上限)。`,
    );
  }

  const all: ScanVisionSegment[] = [];
  for (let start = 1; start <= cap; start += VISION_CHUNK_PAGES) {
    const end = Math.min(start + VISION_CHUNK_PAGES - 1, cap);
    const imgs: string[] = [];
    for (let p = start; p <= end; p++) {
      const img = await renderPageToJpegAt(doc, p, VISION_LONG_EDGE, VISION_QUALITY);
      if (img) imgs.push(img);
    }
    if (imgs.length === 0) continue;
    const chunk = await segmentScanByVision({
      materialName: material.name,
      subjectName,
      gradeLevel: material.gradeLevel ?? "中2",
      imagesPacked: imgs.join("\n"),
      startPdfPage: start,
    });
    all.push(...chunk);
  }

  // 並べ替え → 隣接同名マージ → 重なり解消。
  all.sort((a, b) => a.startPdfPage - b.startPdfPage);
  const merged: ScanVisionSegment[] = [];
  for (const s of all) {
    const last = merged[merged.length - 1];
    if (last && s.conceptName === last.conceptName && s.startPdfPage <= last.endPdfPage + 1) {
      last.endPdfPage = Math.max(last.endPdfPage, s.endPdfPage);
    } else if (last && s.startPdfPage <= last.endPdfPage) {
      const ns = last.endPdfPage + 1;
      if (ns <= s.endPdfPage) merged.push({ ...s, startPdfPage: ns });
    } else {
      merged.push({ ...s });
    }
  }

  return merged.map((s, i) => ({
    id: `seg-${i + 1}`,
    conceptName: s.conceptName,
    startPdfPage: s.startPdfPage,
    endPdfPage: s.endPdfPage,
    source: "scan-vision" as const,
    printPageHint: s.printPageHint,
  }));
}

/**
 * スキャン本 (文字レイヤー無し) から まとまり (ConceptSegment[]) を組み立てる。
 * 目次の体系図ノードが十分あればハイブリッド、無ければ/失敗すれば vision 経路。
 * 何も作れなければ [] (呼び出し側は今ページ要約フォールバックのまま)。
 */
export async function buildScanSegments(
  doc: PDFDocumentProxy,
  material: Material,
  subjectName: string,
): Promise<ConceptSegment[]> {
  const numPages = doc.numPages;
  const usableTocCount = (material.extractedNodes ?? []).filter((n) =>
    parsePageRange(n.pageRange),
  ).length;

  if (usableTocCount >= MIN_TOC_NODES_FOR_HYBRID) {
    try {
      const segs = await buildViaHybrid(doc, material, subjectName, numPages);
      if (segs.length > 0) return segs;
    } catch (err) {
      console.error("[C-8] ハイブリッド経路に失敗、vision 経路へ:", err);
    }
  }

  return await buildViaVision(doc, material, subjectName, numPages);
}
