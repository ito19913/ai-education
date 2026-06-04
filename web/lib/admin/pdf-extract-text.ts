"use client";

/**
 * PDF テキスト抽出 (クライアント側、2026-06-04)
 *
 * 2 つの用途を 1 回の pdf.js ロードで賄う:
 * - **coverText** (メタ検知用、C81): 先頭数ページ + 末尾数ページ
 *   = 教材名・科目・種別・学年は表紙 / 奥付に集中するため
 * - **tocText** (体系図用、段階1-A): 先頭多めのページ
 *   = 目次・章立てから教材固有の体系図 (実単元 + ページ範囲) を作る材料
 *
 * 186MB 級の巨大 PDF 全文は Claude に渡せない (~32MB 上限 + コンテキスト上限) ため、
 * 必要な範囲だけ抽出する。葵が本文の中身を理解して教えるのは別レイヤ
 * (葵 chat 場所指定型 = ページ画像を vision、段階1-C)。
 *
 * 実装メモ:
 * - pdfjs-dist は SSR (Node) で import すると DOM 依存で壊れるため、関数内で動的 import。
 * - worker は web/public/pdf.worker.min.mjs に配置済 (pdfjs-dist と同バージョン)。
 * - スキャン PDF (文字レイヤー無し) はテキストが取れないので空文字列を返す
 *   → 呼び出し側で従来のメタ推測 / 手入力にフォールバックする。
 */

// メタ検知 (cover) 用: 先頭・末尾でそれぞれ読むページ数
const COVER_HEAD_PAGES = 3;
const COVER_TAIL_PAGES = 2;
// 体系図 (toc) 用: 目次・章立てを拾うため先頭多め
const TOC_HEAD_PAGES = 40;
// Claude に渡すテキストの上限文字数
const COVER_MAX_CHARS = 8000;
const TOC_MAX_CHARS = 20000;

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      // worker は public 配下に同バージョンを配置済
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

/** メタ検知用に読むページ番号 (1-indexed): 先頭 COVER_HEAD + 末尾 COVER_TAIL */
function coverPageNumbers(total: number): number[] {
  if (total <= COVER_HEAD_PAGES + COVER_TAIL_PAGES) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>();
  for (let i = 1; i <= COVER_HEAD_PAGES; i++) set.add(i);
  for (let i = 0; i < COVER_TAIL_PAGES; i++) set.add(total - i);
  return [...set].sort((a, b) => a - b);
}

export type IngestionText = {
  /** メタ検知用 (表紙・奥付) */
  coverText: string;
  /** 体系図用 (目次・章立て、先頭多め) */
  tocText: string;
};

/**
 * PDF File から、メタ検知用 (cover) と体系図用 (toc) のテキストを 1 回のロードで抽出する。
 * 失敗・テキスト無しは空文字列を返す (呼び出し側でフォールバック)。
 */
export async function extractIngestionText(file: File): Promise<IngestionText> {
  if (typeof window === "undefined") return { coverText: "", tocText: "" };

  const pdfjs = await getPdfjs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  try {
    const total = doc.numPages;
    const tocLimit = Math.min(TOC_HEAD_PAGES, total);

    // 必要ページ (先頭 tocLimit + 末尾 COVER_TAIL) を 1 回だけ読み、ページ→テキストに保持
    const need = new Set<number>();
    for (let n = 1; n <= tocLimit; n++) need.add(n);
    for (let i = 0; i < COVER_TAIL_PAGES; i++) need.add(total - i);

    const pageTexts = new Map<number, string>();
    for (const n of [...need].sort((a, b) => a - b)) {
      if (n < 1 || n > total) continue;
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pageTexts.set(n, text);
      page.cleanup();
    }

    const render = (nums: number[]): string =>
      nums
        .map((n) => {
          const t = pageTexts.get(n);
          return t && t.length > 0 ? `【p.${n}】 ${t}` : "";
        })
        .filter((s) => s.length > 0)
        .join("\n");

    const coverText = render(coverPageNumbers(total)).slice(0, COVER_MAX_CHARS).trim();
    const tocText = render(
      Array.from({ length: tocLimit }, (_, i) => i + 1),
    )
      .slice(0, TOC_MAX_CHARS)
      .trim();

    return { coverText, tocText };
  } finally {
    await loadingTask.destroy();
  }
}
