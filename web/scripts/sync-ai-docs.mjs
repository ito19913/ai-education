// SSoT ドキュメント (PHILOSOPHY.md / TUTOR-ROLE.md) を TS モジュールに焼き込む。
// 旧実装はランタイムに `process.cwd()/..` で読んでいたが、Vercel デプロイでは
// リポジトリルートのファイルがサーバーレス関数に含まれず全 AI 機能が死ぬため、
// ビルド時 (predev / prebuild) にバンドル可能な文字列定数へ変換する。
// 生成物 (lib/ai/docs.generated.ts) はコミットする — スクリプトを通さない
// チェックアウトでもビルドが通るように。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "..");

const docs = [
  { file: "PHILOSOPHY.md", exportName: "PHILOSOPHY_MD" },
  { file: "TUTOR-ROLE.md", exportName: "TUTOR_ROLE_MD" },
];

let out = `// このファイルは scripts/sync-ai-docs.mjs が生成する。手で編集しない。
// 元データはリポジトリルートの PHILOSOPHY.md / TUTOR-ROLE.md。
// 更新は元ファイルを編集して \`npm run sync:docs\` (dev/build 時は自動実行)。

`;

for (const { file, exportName } of docs) {
  const text = readFileSync(join(repoRoot, file), "utf-8");
  out += `export const ${exportName} = ${JSON.stringify(text)};\n\n`;
}

const outPath = join(webRoot, "lib", "ai", "docs.generated.ts");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out, "utf-8");
console.log(`sync-ai-docs: wrote ${outPath} (${docs.map((d) => d.file).join(", ")})`);
