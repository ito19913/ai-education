import "server-only";

/**
 * pdf-node — サーバー (Node) 側の PDF 処理 (2026-06-13、まとまり生成ジョブ化)
 *
 * ブラウザ版 (pdf-extract-text.ts、"use client" + canvas) と等価の処理を Node で行う。
 * Cron ワーカー (app/api/cron/segment) からのみ使う。
 *
 * ## Node 固有のレシピ (Phase 0 spike で確定)
 * - import は **legacy ビルド** (`pdfjs-dist/legacy/build/pdf.mjs`)。標準ビルドは
 *   DOMMatrix 等のブラウザ global を要求して落ちる。legacy は NodeCanvasFactory /
 *   NodeBinaryDataFactory を isNodeJS で自動選択し、@napi-rs/canvas で描画する。
 * - fake worker (メインスレッド実行) には worker の file:// URL が必要。
 * - データファイル URL (cmaps/standard_fonts/iccs/wasm) は「前方スラッシュ + 末尾 /」。
 * - 描画は @napi-rs/canvas の createCanvas → page.render({canvas,viewport}) →
 *   toBuffer("image/jpeg")。sharp は不要。
 *
 * next.config.ts の serverExternalPackages / outputFileTracingIncludes で
 * pdfjs-dist と @napi-rs/canvas を外部化 + データファイルを同梱している。
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import type { PDFDocumentProxy } from "pdfjs-dist";

// 文字レイヤー判定・上限 (ブラウザ版 pdf-extract-text.ts と同値)。
const FULL_TEXT_MAX_CHARS = 160000;
const DIGITAL_TEXT_MIN_TOTAL = 200;

const NM = path.join(process.cwd(), "node_modules", "pdfjs-dist");
/** pdf.js の factory url 用: 前方スラッシュ + 末尾 / の絶対パス。 */
const asFactoryUrl = (sub: string): string =>
  path.join(NM, sub).split(path.sep).join("/") + "/";

const DATA_URLS = {
  cMapUrl: asFactoryUrl("cmaps"),
  standardFontDataUrl: asFactoryUrl("standard_fonts"),
  iccUrl: asFactoryUrl("iccs"),
  wasmUrl: asFactoryUrl("wasm"),
};

type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function getPdfjsNode(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    // legacy ビルドを動的 import (Node 用ファクトリが isNodeJS で選ばれる)。
    pdfjsPromise = (
      import("pdfjs-dist/legacy/build/pdf.mjs") as Promise<PdfjsModule>
    ).then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = pathToFileURL(
        path.join(NM, "legacy", "build", "pdf.worker.mjs"),
      ).href;
      return mod;
    });
  }
  return pdfjsPromise;
}

export type LoadedPdfNode = {
  doc: PDFDocumentProxy;
  numPages: number;
  destroy: () => Promise<void>;
};

/** Storage から落とした PDF バイト列を Node で 1 回ロードする。 */
export async function loadPdfDocumentNode(
  data: Uint8Array,
): Promise<LoadedPdfNode> {
  const pdfjs = await getPdfjsNode();
  const loadingTask = pdfjs.getDocument({
    data,
    ...DATA_URLS,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  return {
    doc,
    numPages: doc.numPages,
    destroy: async () => {
      await loadingTask.destroy();
    },
  };
}

export type FullPageTextsNode = {
  /** 文字レイヤーがあった (= デジタル PDF、テキスト区切りが使える) */
  hasTextLayer: boolean;
  /** `【pdf:N】 本文` の改行連結 (N = PDF 紙番号 1-indexed)。segment-core がこの N で区切る。 */
  packedText: string;
  numPages: number;
};

/**
 * 本文全ページのテキストを抽出して【pdf:N】タグ付きで連結する (M3、デジタル経路)。
 * ブラウザ版 extractFullPageTextsFromDoc と同じロジック (canvas 不要)。
 */
export async function packFullPageTextsNode(
  doc: PDFDocumentProxy,
): Promise<FullPageTextsNode> {
  const total = doc.numPages;
  const parts: string[] = [];
  let totalLen = 0;
  for (let n = 1; n <= total; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    page.cleanup();
    if (text.length > 0) {
      parts.push(`【pdf:${n}】 ${text}`);
      totalLen += text.length;
    }
    if (totalLen >= FULL_TEXT_MAX_CHARS) break;
  }
  const hasTextLayer = totalLen >= DIGITAL_TEXT_MIN_TOTAL;
  return {
    hasTextLayer,
    packedText: hasTextLayer ? parts.join("\n") : "",
    numPages: total,
  };
}

/**
 * ページを指定の長辺 px / JPEG 品質で描画して base64 (prefix 無し) を返す。失敗時 null。
 * label を渡すと左上に赤バッジで焼き込む (C-8 vision 区切り用の PDF 紙番号ラベル)。
 * ブラウザ版 renderPageToJpegAt の @napi-rs/canvas 版 (document 参照を排除)。
 */
export async function renderPageToJpegBase64Node(
  doc: PDFDocumentProxy,
  pageNum: number,
  longEdge: number,
  quality: number,
  label?: string,
): Promise<string | null> {
  try {
    const page = await doc.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const baseLong = Math.max(base.width, base.height);
    const scale = Math.min(longEdge / baseLong, 3);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const ctx = canvas.getContext("2d");
    // JPEG はアルファ無し。透過部分が黒く出ないよう白で塗る。
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // @napi-rs/canvas を pdf.js v6 にそのまま渡せる (Phase 0 spike 確認済)。
    await page.render({
      // napi canvas は pdf.js が要求する Canvas/2D コンテキスト形を満たすが、
      // 型は DOM の HTMLCanvasElement と異なるためここだけ缝合する。
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;

    if (label) {
      const fontPx = Math.max(20, Math.round(canvas.width * 0.05));
      ctx.font = `bold ${fontPx}px sans-serif`;
      const padX = Math.round(fontPx * 0.45);
      const padY = Math.round(fontPx * 0.3);
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "#dc2626"; // 赤バッジ
      ctx.fillRect(0, 0, Math.ceil(tw + padX * 2), Math.ceil(fontPx + padY * 2));
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "top";
      ctx.fillText(label, padX, padY);
    }

    const buf = canvas.toBuffer("image/jpeg", quality);
    page.cleanup();
    return buf.toString("base64");
  } catch (err) {
    console.error(`[PDF 画像化 Node] p.${pageNum} 描画失敗:`, err);
    return null;
  }
}
