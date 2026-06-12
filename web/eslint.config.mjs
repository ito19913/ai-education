import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ベンダー配布物 (pdf.js worker / JBIG2 wasm フォールバック)。手を入れない
    // minified ファイルで、lint 対象にすると既知エラー 10 件のノイズになるだけ。
    "public/pdf.worker.min.mjs",
    "public/pdfjs-wasm/**",
    // ビルド時に scripts/sync-ai-docs.mjs が生成 (PHILOSOPHY/TUTOR-ROLE の焼き込み)
    "lib/ai/docs.generated.ts",
  ]),
]);

export default eslintConfig;
