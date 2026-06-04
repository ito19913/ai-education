import type { NextConfig } from "next";
import path from "node:path";

// プロジェクトルートを明示する。次の事故を防ぐ目的:
//   1. 親ディレクトリ（ホーム直下など）に lockfile が紛れていると Next.js が
//      そこをワークスペースルートと誤認識し、`outputFileTracing` が想定外の範囲を辿る
//   2. モノレポに将来取り込まれた場合でも本ディレクトリが基準になる
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
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
