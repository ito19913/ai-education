/**
 * /philosophy — AI-Education の憲法 (PHILOSOPHY.md) を表示する画面。
 *
 * PHILOSOPHY.md はビルド時に scripts/sync-ai-docs.mjs が docs.generated.ts へ
 * 焼き込んだ定数 (PHILOSOPHY_MD) を使う。リポジトリルートのファイルを
 * ランタイム/ビルド時に fs で読むと Vercel (Root Directory = web) で
 * サーバーレス関数に含まれず死ぬため、焼き込み済み定数を参照する。
 */
import { PHILOSOPHY_MD } from "@/lib/ai/docs.generated";
import { PhilosophyView } from "@/components/philosophy/PhilosophyView";

export const metadata = {
  title: "AI-Education の憲法",
};

export default function PhilosophyPage() {
  return <PhilosophyView content={PHILOSOPHY_MD} />;
}
