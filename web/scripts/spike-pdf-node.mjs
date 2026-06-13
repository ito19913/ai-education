// Phase 0 spike: Node 上で pdfjs-dist + @napi-rs/canvas が
// ①テキスト抽出 ②ページ→JPEG(赤バッジ焼き込み) を実行できるか確認する。
// ローカル(win32)で正しさを確認 → 本番(linux serverless)はデプロイで別途確認。
//
// 実行: node scripts/spike-pdf-node.mjs ../docs/PHILOSOPHY.pdf
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NM = path.join(__dirname, "..", "node_modules", "pdfjs-dist");
// pdf.js は factory url に「前方スラッシュ + 末尾 /」を要求する (Windows の \ は不可)。
const asUrl = (sub) => (path.join(NM, sub).split(path.sep).join("/")) + "/";
const dataUrls = {
  cMapUrl: asUrl("cmaps"),
  standardFontDataUrl: asUrl("standard_fonts"),
  iccUrl: asUrl("iccs"),
  wasmUrl: asUrl("wasm"),
};

const pdfPath = process.argv[2] ?? path.join(__dirname, "..", "..", "docs", "PHILOSOPHY.pdf");

async function main() {
  console.log("[spike] node", process.version, process.platform, process.arch);

  // 1) 動的 import: Node では legacy ビルド (NodeCanvasFactory が isNodeJS で自動選択)。
  //    標準ビルドは DOMMatrix 等のブラウザ global を要求して落ちる。
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Node の fake worker (メインスレッド実行) には worker の file:// URL が要る。
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(NM, "legacy", "build", "pdf.worker.mjs"),
  ).href;

  // 2) PDF ロード
  const buf = await readFile(pdfPath);
  const data = new Uint8Array(buf);
  const loadingTask = pdfjs.getDocument({
    data,
    ...dataUrls,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  console.log("[spike] loaded:", pdfPath, "pages =", doc.numPages);

  // 3) テキスト抽出 (canvas 不要、デジタル経路)
  const page1 = await doc.getPage(1);
  const content = await page1.getTextContent();
  const text = content.items
    .map((it) => ("str" in it ? it.str : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  console.log("[spike] page1 text length =", text.length);
  console.log("[spike] page1 text head =", JSON.stringify(text.slice(0, 80)));

  // 4) ページ→JPEG (napi canvas) + 「PDF-1」赤バッジ焼き込み
  const { createCanvas } = await import("@napi-rs/canvas");
  const base = page1.getViewport({ scale: 1 });
  const longEdge = 1000;
  const scale = Math.min(longEdge / Math.max(base.width, base.height), 3);
  const viewport = page1.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // pdf.js v6: napi canvas をそのまま渡せるか確認
  await page1.render({ canvas, viewport }).promise;

  const label = "PDF-1";
  const fontPx = Math.max(20, Math.round(canvas.width * 0.05));
  ctx.font = `bold ${fontPx}px sans-serif`;
  const padX = Math.round(fontPx * 0.45);
  const padY = Math.round(fontPx * 0.3);
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(0, 0, Math.ceil(tw + padX * 2), Math.ceil(fontPx + padY * 2));
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.fillText(label, padX, padY);

  const jpeg = canvas.toBuffer("image/jpeg", 0.6);
  const out = path.join(__dirname, "spike-out.jpg");
  await writeFile(out, jpeg);
  console.log("[spike] rendered JPEG:", canvas.width, "x", canvas.height, jpeg.length, "bytes →", out);

  page1.cleanup();
  await loadingTask.destroy();
  console.log("[spike] ✅ OK — text extraction + napi-canvas render both succeeded in Node");
}

main().catch((err) => {
  console.error("[spike] ❌ FAILED:", err);
  process.exit(1);
});
