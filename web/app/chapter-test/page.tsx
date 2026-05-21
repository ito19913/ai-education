/**
 * /chapter-test — 単元完了テスト（遡及式診断）。
 *
 * URL パラメータ:
 *   ?node=inf-noun  対象ノードを指定（無ければ初期値 inf-noun）
 *
 * フロー: 3 ルール儀式 → 問題群（最大 3 問）→ スコア → 合否
 *         不合格時は親ノードで再診断（escalation）→ ルートまで遡及可
 */
import { ChapterTestWorkspace } from "@/components/chapter-test/ChapterTestWorkspace";
import { MOCK_TREE } from "@/lib/learn/mock-data";
import { MOCK_QUESTIONS } from "@/lib/learn/test-mock-data";

type Props = {
  searchParams: Promise<{ node?: string }>;
};

export default async function ChapterTestPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialNodeId = params.node ?? "inf-noun";

  return (
    <div className="min-h-screen bg-background">
      <ChapterTestWorkspace
        initialNodeId={initialNodeId}
        allNodes={MOCK_TREE}
        allQuestions={MOCK_QUESTIONS}
        maxQuestionsPerLevel={3}
      />
    </div>
  );
}
