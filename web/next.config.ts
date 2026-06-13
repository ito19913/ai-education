import type { NextConfig } from "next";
import path from "node:path";

// プロジェクトルートを明示する。次の事故を防ぐ目的:
//   1. 親ディレクトリ（ホーム直下など）に lockfile が紛れていると Next.js が
//      そこをワークスペースルートと誤認識し、`outputFileTracing` が想定外の範囲を辿る
//   2. モノレポに将来取り込まれた場合でも本ディレクトリが基準になる
const projectRoot = path.resolve(__dirname);

// ★Vercel では root を固定しない★
// Vercel は Root Directory=web を明示しており、ここで turbopack.root /
// outputFileTracingRoot を web に固定すると、ビルド後の Vercel 側 manifest 生成が
// `.next` をリポジトリルート (/vercel/path0/.next) で探して ENOENT になる
// (routes-manifest-deterministic.json)。Vercel ではデフォルトに任せ、root 固定は
// ローカル (親 lockfile 誤認識の防止) のみ適用する。
const rootPinning: Pick<NextConfig, "turbopack" | "outputFileTracingRoot"> =
  process.env.VERCEL
    ? {}
    : { turbopack: { root: projectRoot }, outputFileTracingRoot: projectRoot };

const nextConfig: NextConfig = {
  ...rootPinning,
  /**
   * まとまり生成のサーバー側ジョブ化 (2026-06-13)。
   * Cron ワーカー (app/api/cron/segment) が Node 上で pdfjs-dist (legacy build) +
   * @napi-rs/canvas でテキスト抽出・ページ描画する。これらはネイティブ依存 + 動的
   * require/fs 読みのため Next のバンドルに乗らない → 外部化する。
   */
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  /**
   * pdf.js の worker / データファイル (cmaps/standard_fonts/iccs/wasm) と
   * @napi-rs/canvas の linux ネイティブバイナリを Cron Route の serverless 関数へ
   * 明示同梱する (動的 require/fs.readFile はトレースされないため欠落するのを防ぐ)。
   */
  outputFileTracingIncludes: {
    "/api/cron/segment": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/cmaps/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/iccs/**",
      "./node_modules/pdfjs-dist/wasm/**",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**",
    ],
  },
  experimental: {
    /**
     * 教材登録のスキャン PDF 対応 (段階1-A、C85)。
     * 自炊 PDF (真・英文法大全 186MB 等) は文字レイヤーが無いため目次ページを
     * JPEG 画像化して Server Action (extract-claude / detect-meta-claude) に渡す。
     * 画像 12 枚程度で数 MB になるため、Server Action の body 上限
     * (デフォルト 1MB) を引き上げる。画像は配列ではなく改行連結の 1 文字列で
     * 渡している ("Maximum array nesting exceeded" ガード回避、C85)。
     */
    serverActions: {
      bodySizeLimit: "24mb",
    },
  },
};

export default nextConfig;
