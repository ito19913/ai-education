/**
 * /test — 悪い癖の強制矯正システム（テスト機能）の MVP モック。
 *
 * MVP 仕様:
 *   - target: 不定詞 名詞的用法（inf-noun）固定
 *   - 4 つの候補: target の問題 1 つ + 異なる論点の問題 3 つ
 *   - 1 サイクル（メタ問題 → 実問題）で完結
 *
 * 後で:
 *   - target はユーザーが選択 or ランダム
 *   - 複数サイクルで連続出題
 *   - 結果を Supabase に保存、復習対象に追加
 */
import { TestWorkspace } from "@/components/test/TestWorkspace";
import { MOCK_TREE } from "@/lib/learn/mock-data";
import { MOCK_QUESTIONS } from "@/lib/learn/test-mock-data";
import type { KnowledgeNode } from "@/lib/learn/types";

export default function TestPage() {
  // MVP では target を不定詞 名詞的用法 固定
  const targetNodeId = "inf-noun";
  const targetNode = MOCK_TREE.find((n) => n.id === targetNodeId)!;

  // target の問題 1 つ（先頭）
  const correctQuestion = MOCK_QUESTIONS.find(
    (q) => q.nodeId === targetNodeId,
  )!;

  // 異なる論点の問題 3 つ（ダミー）
  const distractors = MOCK_QUESTIONS.filter(
    (q) => q.nodeId !== targetNodeId,
  ).slice(0, 3);

  // 4 問をシャッフル（決定論的な mock のため、固定順）
  const candidates = [correctQuestion, ...distractors];

  // nodeId → KnowledgeNode のマップ
  const nodesById: Record<string, KnowledgeNode> = Object.fromEntries(
    MOCK_TREE.map((n) => [n.id, n]),
  );

  return (
    <div className="min-h-screen bg-background">
      <TestWorkspace
        targetNode={targetNode}
        candidates={candidates}
        correctQuestionId={correctQuestion.id}
        nodesById={nodesById}
      />
    </div>
  );
}
