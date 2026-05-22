/**
 * /philosophy — AI-Education の憲法 (PHILOSOPHY.md) を表示する画面。
 *
 * Server Component で PHILOSOPHY.md をビルド時に読み込む。
 * 哲学を更新したら、ファイル編集 → ページ再生成（dev は HMR）で反映される。
 */
import { promises as fs } from "fs";
import path from "path";
import { PhilosophyView } from "@/components/philosophy/PhilosophyView";

export const metadata = {
  title: "AI-Education の憲法",
};

export default async function PhilosophyPage() {
  // web/ ディレクトリの一つ上に PHILOSOPHY.md がある
  const filePath = path.join(process.cwd(), "..", "PHILOSOPHY.md");
  const content = await fs.readFile(filePath, "utf-8");
  return <PhilosophyView content={content} />;
}
