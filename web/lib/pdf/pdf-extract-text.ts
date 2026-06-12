"use client";

/**
 * PDF テキスト / 画像 抽出 (クライアント側、2026-06-04、C85 で vision 対応)
 *
 * 2 つの用途を 1 回の pdf.js ロードで賄う:
 * - **coverText / coverImages** (メタ検知用、C81): 表紙・奥付
 * - **tocText / tocImages** (体系図用、段階1-A): 目次・章立て
 *
 * ## C85: スキャン / 自炊 PDF (文字レイヤー無し) 対応
 *
 * 真・英文法大全 (186MB) のような自炊 PDF は全ページが画像で、getTextContent が
 * 空文字列を返す (= 旧実装の tocLen:0 バグの正体)。文字を「抽出」できないので、
 * **対象ページを画像化して Claude に vision で読ませる** 方式にフォールバックする:
 *
 * 1. まず従来通りテキスト抽出を試みる (デジタル PDF はこれで足りる = 安い・速い)。
 * 2. テキストがほぼ取れなければ (スキャン判定) 対象ページを JPEG に描画して画像で返す。
 * 3. 画像化も失敗すれば mode:"empty" (呼び出し側で従来のメタ推測 / 手入力に落ちる)。
 *
 * 葵が本文の中身を理解して教えるのは別レイヤ (段階1-C vision chat)。本ファイルは
 * 登録時の「表紙メタ + 目次の体系図」だけを担う。
 *
 * 実装メモ:
 * - pdfjs-dist は SSR (Node) で import すると DOM 依存で壊れるため、関数内で動的 import。
 * - worker は web/public/pdf.worker.min.mjs に配置済 (pdfjs-dist と同バージョン)。
 * - 画像は long edge を Claude 推奨上限 (~1568px) 付近に抑え、JPEG で payload を圧縮する。
 *   画像配列は Server Action 経由で Claude に渡すため、next.config の
 *   serverActions.bodySizeLimit を引き上げてある。
 */

// メタ検知 (cover) 用: 先頭・末尾でそれぞれ読むページ数
const COVER_HEAD_PAGES = 3;
const COVER_TAIL_PAGES = 2;
// 体系図 (toc) 用: 目次・章立てを拾うため先頭多め
const TOC_HEAD_PAGES = 40;
// Claude に渡すテキストの上限文字数
const COVER_MAX_CHARS = 8000;
const TOC_MAX_CHARS = 20000;

// --- スキャン PDF の vision フォールバック設定 (C85) ---
// テキスト抽出がこの文字数未満ならスキャン PDF と判定して画像化する。
const SCANNED_TEXT_THRESHOLD = 40;
// もくじは「長い はじめに」の後ろに来ることがあるので、先頭から広めに画像化する
// (真・英文法大全は前付けが長く、もくじが先頭 12 ページに入らなかった = C85 で判明)。
const TOC_IMAGE_PAGES = 32;
// メタ検知は表紙 (先頭数ページ) で足りる。
const COVER_IMAGE_PAGES = 3;
// 画像の長辺ターゲット px。Claude は長辺 ~1568px 超を内部縮小するので、その上限に
// 合わせる (目次右端の小さいページ番号まで読めるよう、これ以上は下げない)。
const IMAGE_TARGET_LONG_EDGE = 1568;
// JPEG 品質。小さな数字 (ページ番号) が潰れない程度を確保しつつ payload を抑える。
const IMAGE_JPEG_QUALITY = 0.72;

import type { PDFDocumentProxy } from "pdfjs-dist";

// pdf.js v6 の JBIG2/JPEG2000 画像デコーダ wasm の配置先 (public/pdfjs-wasm/)。
// JBIG2 で圧縮された自炊スキャン本は、これが無いとページが真っ白になる (描画失敗)。
// node_modules/pdfjs-dist/wasm/*.wasm を public/pdfjs-wasm/ にコピー済み。
const WASM_URL = "/pdfjs-wasm/";

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
  /**
   * 抽出モード:
   * - "text": 文字レイヤーから抽出 (デジタル PDF)。tocText に値。
   * - "outline": スキャン PDF だが PDF のしおり (目次) があった。tocText にしおり由来の
   *   目次 (正確なページ付き)、coverImages に表紙画像 (メタ検知用)。
   * - "image": スキャン PDF でしおり無し。coverImages / tocImages に画像。
   * - "empty": どれも取れず (呼び出し側で手入力にフォールバック)。
   */
  mode: "text" | "outline" | "image" | "empty";
  /** メタ検知用テキスト (表紙・奥付)。mode:"text" のみ */
  coverText: string;
  /** 体系図用テキスト (目次・章立て)。mode:"text" のみ */
  tocText: string;
  /** メタ検知用ページ画像 (base64 JPEG、prefix 無し)。mode:"image" のみ */
  coverImages: string[];
  /** 体系図用ページ画像 (base64 JPEG、prefix 無し)。mode:"image" のみ */
  tocImages: string[];
};

/**
 * ページを指定の長辺 px / JPEG 品質で描画して base64 (prefix 無し) を返す。失敗時 null。
 * longEdge / quality を呼び出し側で選べる (C-8: vision 区切りは低解像度で payload とコストを
 * 抑え、オフセット較正の番号読みは高めの解像度で小さなノンブルを読む、と使い分ける)。
 */
export async function renderPageToJpegAt(
  doc: PDFDocumentProxy,
  pageNum: number,
  longEdge: number,
  quality: number,
  /**
   * 指定すると左上に赤バッジでこの文字列を焼き込む (C-8 vision 区切り用)。
   * スキャン本では AI が「PDF の何枚目か」を数えられず、紙面に印刷された番号を
   * 返してしまう (印刷↔PDF のオフセットは非一定で換算不能)。そこで PDF 紙番号を
   * こちらで焼き込み、AI には「このバッジの番号」を返させて正確なジャンプ先を得る。
   */
  label?: string,
): Promise<string | null> {
  try {
    const page = await doc.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const baseLong = Math.max(base.width, base.height);
    // 拡大はしない (scale<=3 で上限、潰れた小さい PDF の暴走防止)
    const scale = Math.min(longEdge / baseLong, 3);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      page.cleanup();
      return null;
    }
    // JPEG はアルファ無し。透過部分が黒く出ないよう、描画前に白で塗りつぶす。
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // v6 では canvas を渡すのが推奨 (canvasContext は後方互換)。
    await page.render({ canvas, viewport }).promise;

    // PDF 紙番号のラベルを左上に焼き込む (vision 区切りの正確なジャンプ先用)。
    if (label) {
      const fontPx = Math.max(20, Math.round(canvas.width * 0.05));
      ctx.font = `bold ${fontPx}px sans-serif`;
      const padX = Math.round(fontPx * 0.45);
      const padY = Math.round(fontPx * 0.3);
      const tw = ctx.measureText(label).width;
      const bw = Math.ceil(tw + padX * 2);
      const bh = Math.ceil(fontPx + padY * 2);
      ctx.fillStyle = "#dc2626"; // 赤バッジ (紙面の番号と区別しやすい)
      ctx.fillRect(0, 0, bw, bh);
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "top";
      ctx.fillText(label, padX, padY);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    page.cleanup();
    // canvas を解放 (大きな PDF を多数描画するときのメモリ対策)
    canvas.width = 0;
    canvas.height = 0;
    const comma = dataUrl.indexOf(",");
    return comma >= 0 ? dataUrl.slice(comma + 1) : null;
  } catch (err) {
    console.error(`[PDF 画像化] p.${pageNum} 描画失敗:`, err);
    return null;
  }
}

/**
 * 表紙 (1 ページ目) を教材一覧サムネ用の小さな data URL (JPEG) にする (2026-06-08)。
 * <img src> にそのまま使える形 (data:image/jpeg;base64,...) で返す。失敗時 null。
 */
export async function renderCoverThumb(
  doc: PDFDocumentProxy,
): Promise<string | null> {
  // 本棚グリッドで表紙が主役なので、やや高解像度 (長辺 360px) でクリスプに。
  // それでも ~20-30KB の小さな JPEG なので data URL で DB 保存して問題ない。
  const b64 = await renderPageToJpegAt(doc, 1, 360, 0.7);
  return b64 ? `data:image/jpeg;base64,${b64}` : null;
}

/** ページを JPEG に描画して base64 (prefix 無し) を返す (既定の高解像度)。失敗時 null。 */
export async function renderPageToJpeg(
  doc: PDFDocumentProxy,
  pageNum: number,
): Promise<string | null> {
  return renderPageToJpegAt(doc, pageNum, IMAGE_TARGET_LONG_EDGE, IMAGE_JPEG_QUALITY);
}

// ============================================================================
// 読書ビュー (段階1-C「一緒にめくって読む」) 用のページ描画ヘルパー
// 同一 doc から「画面表示用 canvas 描画」と「vision 用 JPEG (renderPageToJpeg)」を
// 両立できる (二重ロード不要)。
// ============================================================================

export type LoadedPdf = {
  doc: PDFDocumentProxy;
  numPages: number;
  /** 使い終わったら呼ぶ (loadingTask を破棄してメモリ解放)。 */
  destroy: () => Promise<void>;
};

/** File から PDF doc を 1 回だけロードする (読書ビューが doc を保持して任意ページを描画)。 */
export async function loadPdfDocument(file: File): Promise<LoadedPdf> {
  const pdfjs = await getPdfjs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data, wasmUrl: WASM_URL });
  const doc = await loadingTask.promise;
  return {
    doc,
    numPages: doc.numPages,
    destroy: async () => {
      await loadingTask.destroy();
    },
  };
}

/**
 * ページを画面表示用 canvas に描画する (高 DPI 対応)。
 * canvas のピクセルバッファは targetCssWidth × devicePixelRatio で確保し、
 * 表示サイズ (CSS) は論理 px で固定する。
 *
 * ★競合対策★: zoom/resize で同じ canvas に対して描画が連続発火すると、pdf.js が
 * 同一 canvas に同時描画して結果が崩れる (上下反転など)。直前の描画タスクを cancel し、
 * token で「最新の要求だけ」描画する (古い要求は getPage 後に破棄)。
 */
type CanvasRenderState = HTMLCanvasElement & {
  __renderTask?: { cancel: () => void };
  __renderToken?: number;
};

export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  targetCssWidth: number,
): Promise<void> {
  const c = canvas as CanvasRenderState;
  // 直前の描画を中断 (in-flight なら cancel、await は reject される)
  c.__renderTask?.cancel?.();
  const token = (c.__renderToken ?? 0) + 1;
  c.__renderToken = token;

  const page = await doc.getPage(pageNum);
  // getPage 中に新しい描画要求が来ていたら、この (古い) 要求は破棄
  if (c.__renderToken !== token) {
    page.cleanup();
    return;
  }

  const base = page.getViewport({ scale: 1 });
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const scale = (Math.max(targetCssWidth, 1) * dpr) / base.width;
  const viewport = page.getViewport({ scale });

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  // バッファは dpr 倍 (高精細)、表示サイズは論理 px で固定 (dpr>1 でレイアウトが狂わないように)
  canvas.style.width = `${Math.round(targetCssWidth)}px`;
  canvas.style.height = "auto";
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    page.cleanup();
    return;
  }
  // スキャン PDF の透過部分が黒く出ないよう白で塗る。
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const task = page.render({ canvas, viewport });
  c.__renderTask = task;
  try {
    await task.promise;
  } catch {
    // cancel された (新しい描画に置き換わった) 場合は無視
  } finally {
    if (c.__renderToken === token) c.__renderTask = undefined;
    page.cleanup();
  }
}

/**
 * renderPageToCanvas で描画した canvas のピクセルバッファを解放する。
 * in-flight の描画タスクは cancel し、token を進めて getPage 中の古い要求も破棄させる。
 * 表示上の高さは style.height に固定してから 0 にする (サムネレールでバッファだけ
 * 解放してもレイアウトが潰れてスクロール位置が飛ばないように)。再描画すると
 * renderPageToCanvas が style.height を "auto" に戻す。
 */
export function releasePageCanvas(canvas: HTMLCanvasElement): void {
  const c = canvas as CanvasRenderState;
  c.__renderTask?.cancel?.();
  c.__renderTask = undefined;
  c.__renderToken = (c.__renderToken ?? 0) + 1;
  if (canvas.width > 0) {
    canvas.style.height = `${canvas.clientHeight}px`;
    canvas.width = 0;
    canvas.height = 0;
  }
}

// 全書区切り (まとまり M4) 用: 本文テキスト抽出の上限文字数。
const FULL_TEXT_MAX_CHARS = 160000;
// 文字レイヤーがあると判定する 1 ページあたり平均文字数の下限 (これ未満ならスキャン扱い)。
const DIGITAL_TEXT_MIN_TOTAL = 200;

export type FullPageTexts = {
  /** 文字レイヤーがあった (= デジタル PDF、テキスト区切りが使える) */
  hasTextLayer: boolean;
  /**
   * 本文全ページのテキストを `【pdf:N】 ...` の改行連結で 1 文字列にしたもの。
   * N は PDF 紙番号 (1-indexed)。segment-claude がこの N で区切りを返す (M3)。
   */
  packedText: string;
  /** 総ページ数 */
  numPages: number;
};

/**
 * PDF File から本文全ページのテキストを抽出する (デジタル PDF の全書区切り用、M4)。
 * 各ページを `【pdf:N】 本文` でタグ付けして連結。文字レイヤーが無い (スキャン) 場合は
 * hasTextLayer:false を返す (呼び出し側は区切りをスキップ、将来 C-8 の vision 経路へ)。
 */
export async function extractFullPageTexts(file: File): Promise<FullPageTexts> {
  const EMPTY: FullPageTexts = {
    hasTextLayer: false,
    packedText: "",
    numPages: 0,
  };
  if (typeof window === "undefined") return EMPTY;

  const loaded = await loadPdfDocument(file);
  try {
    return await extractFullPageTextsFromDoc(loaded.doc);
  } finally {
    await loaded.destroy();
  }
}

/**
 * ロード済み doc から本文全ページのテキストを抽出する。
 * 呼び出し側が既に doc を持っている場合 (読書ビュー / 登録フロー) はこちらを使う —
 * extractFullPageTexts(file) は 186MB 級の PDF をもう 1 部ロードしてしまう (Phase 2 メモリ対策)。
 */
export async function extractFullPageTextsFromDoc(
  doc: PDFDocumentProxy,
): Promise<FullPageTexts> {
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
    // 上限到達で打ち切り (巨大本のコスト/速度対策、末尾は概念区切りに不要なことが多い)
    if (totalLen >= FULL_TEXT_MAX_CHARS) break;
  }
  const hasTextLayer = totalLen >= DIGITAL_TEXT_MIN_TOTAL;
  return {
    hasTextLayer,
    packedText: hasTextLayer ? parts.join("\n") : "",
    numPages: total,
  };
}

/** PDF の outline (しおり) ノードの最小型 */
type OutlineNode = {
  title: string;
  dest: string | unknown[] | null;
  items?: OutlineNode[];
};

/** outline の dest を 1-indexed のページ番号に解決する。失敗時 null。 */
async function resolveOutlinePage(
  doc: PDFDocumentProxy,
  dest: string | unknown[] | null,
): Promise<number | null> {
  try {
    const explicit = typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const ref = explicit[0];
    if (ref == null || typeof ref !== "object") return null;
    const pageIndex = await doc.getPageIndex(
      ref as Parameters<typeof doc.getPageIndex>[0],
    );
    return pageIndex + 1;
  } catch {
    return null;
  }
}

/**
 * PDF のしおり (outline) を、ページ番号付きの目次テキストに変換する。
 * しおりが無い / 取れない場合は "" を返す (呼び出し側で画像 vision にフォールバック)。
 * スキャン PDF でもしおりが付いていれば、これが最も正確な目次 (実ページ付き)。
 */
async function extractOutlineAsText(doc: PDFDocumentProxy): Promise<string> {
  let outline: OutlineNode[] | null = null;
  try {
    outline = (await doc.getOutline()) as OutlineNode[] | null;
  } catch {
    return "";
  }
  if (!outline || outline.length === 0) return "";

  const lines: string[] = [];
  const walk = async (nodes: OutlineNode[], depth: number): Promise<void> => {
    for (const node of nodes) {
      const title = (node.title ?? "").trim();
      if (title) {
        const page = await resolveOutlinePage(doc, node.dest);
        // 階層は全角スペースで表現 (extract-claude がツリーに復元する)
        lines.push(
          `${"　".repeat(depth)}${title}${page ? ` …… p.${page}` : ""}`,
        );
      }
      if (node.items && node.items.length > 0) {
        await walk(node.items, depth + 1);
      }
    }
  };
  await walk(outline, 0);
  return lines.join("\n");
}

/**
 * PDF File から、メタ検知用 (cover) と体系図用 (toc) の素材を 1 回のロードで抽出する。
 * デジタル PDF は文字列、スキャン PDF はしおり→ページ画像の順、どれも無理なら mode:"empty"。
 */
export async function extractIngestionText(file: File): Promise<IngestionText> {
  const EMPTY: IngestionText = {
    mode: "empty",
    coverText: "",
    tocText: "",
    coverImages: [],
    tocImages: [],
  };
  if (typeof window === "undefined") return EMPTY;

  const pdfjs = await getPdfjs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data, wasmUrl: WASM_URL });
  const doc = await loadingTask.promise;

  try {
    const total = doc.numPages;
    const tocLimit = Math.min(TOC_HEAD_PAGES, total);

    // --- 1) 文字レイヤーからのテキスト抽出 (デジタル PDF はこれで完結) ---
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

    // テキストが十分取れていれば text モードで完了 (安い・速い)
    if (
      coverText.length >= SCANNED_TEXT_THRESHOLD ||
      tocText.length >= SCANNED_TEXT_THRESHOLD
    ) {
      return { mode: "text", coverText, tocText, coverImages: [], tocImages: [] };
    }

    // --- 2) スキャン / 自炊 PDF (C85) ---
    // 表紙画像は常に必要 (メタ検知用)。先頭数ページを描画する。
    const coverImages: string[] = [];
    for (let n = 1; n <= Math.min(COVER_IMAGE_PAGES, total); n++) {
      const img = await renderPageToJpeg(doc, n);
      if (img) coverImages.push(img);
    }

    // 2a) PDF にしおり (outline) があれば、それが正確なページ付きの目次。
    //     画像 vision より確実なので最優先で使う (画像描画も省ける)。
    const outlineText = await extractOutlineAsText(doc);
    if (outlineText.length >= SCANNED_TEXT_THRESHOLD) {
      return {
        mode: "outline",
        coverText: "",
        tocText: outlineText,
        coverImages,
        tocImages: [],
      };
    }

    // 2b) しおり無し → もくじページを画像化して vision に回す。
    //     もくじは長い前付けの後ろに来ることがあるので先頭から広めに描画する。
    const tocImages: string[] = [];
    for (let n = 1; n <= Math.min(TOC_IMAGE_PAGES, total); n++) {
      const img = await renderPageToJpeg(doc, n);
      if (img) tocImages.push(img);
    }

    if (tocImages.length === 0 && coverImages.length === 0) {
      return EMPTY;
    }
    return { mode: "image", coverText: "", tocText: "", coverImages, tocImages };
  } finally {
    await loadingTask.destroy();
  }
}
