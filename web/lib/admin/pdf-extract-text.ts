"use client";

/**
 * PDF 表紙テキスト抽出 (クライアント側、2026-06-04)
 *
 * 教材登録ウィザード Step1 の PDF メタ自動検知の第 1 段階。
 * grill (2026-06-04) 確定: 186MB 級の巨大 PDF 全文は Claude に渡せない (~32MB 上限) ため、
 * ブラウザ側で pdf.js を使って「先頭数ページ + 末尾数ページ」だけテキスト抽出し、
 * その短いテキストだけを Server Action (detect-meta-claude.ts) 経由で Claude に渡す。
 *
 * 教材名・科目・種別・学年の判断材料は表紙 / 目次 / 奥付に集中しているので、
 * 先頭 + 末尾の数ページで十分という判断。
 *
 * 実装メモ:
 * - pdfjs-dist は SSR (Node) で import すると DOM 依存で壊れるため、関数内で動的 import。
 * - worker は web/public/pdf.worker.min.mjs に配置済 (pdfjs-dist と同バージョン)。
 * - スキャン PDF (文字レイヤー無し) はテキストが取れないので空文字列を返す
 *   → 呼び出し側で「全項目空欄 = 従来の手入力」にフォールバックする。
 */

// 先頭・末尾でそれぞれ読むページ数 (精度を見て調整可)
const HEAD_PAGES = 3;
const TAIL_PAGES = 2;
// Claude に渡すテキストの上限文字数
const MAX_CHARS = 8000;

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

/** 読むページ番号 (1-indexed) を、先頭 HEAD + 末尾 TAIL で重複なく決める */
function pickPageNumbers(total: number): number[] {
  if (total <= HEAD_PAGES + TAIL_PAGES) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>();
  for (let i = 1; i <= HEAD_PAGES; i++) set.add(i);
  for (let i = 0; i < TAIL_PAGES; i++) set.add(total - i);
  return [...set].sort((a, b) => a - b);
}

/**
 * PDF File から表紙・目次・奥付あたりのテキストを抽出する。
 * 失敗・テキスト無しは空文字列を返す (呼び出し側でフォールバック)。
 */
export async function extractCoverText(file: File): Promise<string> {
  if (typeof window === "undefined") return "";

  const pdfjs = await getPdfjs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  try {
    const total = doc.numPages;
    const pageNumbers = pickPageNumbers(total);
    const chunks: string[] = [];

    for (const n of pageNumbers) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > 0) {
        chunks.push(`【p.${n}】 ${text}`);
      }
      page.cleanup();
    }

    return chunks.join("\n").slice(0, MAX_CHARS).trim();
  } finally {
    await loadingTask.destroy();
  }
}
