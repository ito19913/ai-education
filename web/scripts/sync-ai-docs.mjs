// SSoT ドキュメント (PHILOSOPHY.md / TUTOR-ROLE.md) を TS モジュールに焼き込む。
// 旧実装はランタイムに `process.cwd()/..` で読んでいたが、Vercel デプロイでは
// リポジトリルートのファイルがサーバーレス関数に含まれず全 AI 機能が死ぬため、
// ビルド時 (predev / prebuild) にバンドル可能な文字列定数へ変換する。
// 生成物 (lib/ai/docs.generated.ts) はコミットする — スクリプトを通さない
// チェックアウトでもビルドが通るように。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "..");

const docs = [
  { file: "PHILOSOPHY.md", exportName: "PHILOSOPHY_MD" },
  { file: "TUTOR-ROLE.md", exportName: "TUTOR_ROLE_MD" },
];

const outPath = join(webRoot, "lib", "ai", "docs.generated.ts");

// ★Vercel (Root Directory = web) では root の上のファイルがビルドに含まれない
// 設定がありうる。元ファイルが読めない場合は、commit 済みの生成物をそのまま使い
// (スキップ)、ビルドを失敗させない。元ファイルがある環境 (ローカル等) では再生成する。
const missing = docs.filter(({ file }) => !existsSync(join(repoRoot, file)));
if (missing.length > 0) {
  if (existsSync(outPath)) {
    console.log(
      `sync-ai-docs: source(s) not found (${missing
        .map((d) => d.file)
        .join(", ")}); keeping committed ${outPath}`,
    );
    process.exit(0);
  }
  // 生成物も無いなら本当に必要 — 明示的に失敗させる。
  throw new Error(
    `sync-ai-docs: source docs missing and no committed ${outPath}: ${missing
      .map((d) => d.file)
      .join(", ")}`,
  );
}

let out = `// このファイルは scripts/sync-ai-docs.mjs が生成する。手で編集しない。
// 元データはリポジトリルートの PHILOSOPHY.md / TUTOR-ROLE.md。
// 更新は元ファイルを編集して \`npm run sync:docs\` (dev/build 時は自動実行)。

`;

for (const { file, exportName } of docs) {
  const text = readFileSync(join(repoRoot, file), "utf-8");
  out += `export const ${exportName} = ${JSON.stringify(text)};\n\n`;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out, "utf-8");
console.log(`sync-ai-docs: wrote ${outPath} (${docs.map((d) => d.file).join(", ")})`);
