/**
 * /learn — 学習画面（モック）。
 *
 * MVP のモック段階。サンプルデータ（中2 英語・不定詞）をハードコードして
 * 4 ペイン構造の体験を確認する。後で Supabase 連携に置き換える。
 *
 * 認証チェックは proxy.ts のルート保護に任せる（未ログインなら自動で /login）。
 */
import { LearnWorkspace } from "@/components/learn/LearnWorkspace";
import {
  MOCK_CURRENT_NODE_ID,
  MOCK_ISSUES,
  MOCK_MATERIALS,
  MOCK_MESSAGES,
  MOCK_NOTES,
  MOCK_SESSION_ISSUE_CANDIDATES,
  MOCK_SUBJECT,
  MOCK_SUBJECTS,
  MOCK_TREE,
  MOCK_USER,
} from "@/lib/learn/mock-data";

type Props = {
  searchParams: Promise<{ node?: string; startDay?: string }>;
};

export default async function LearnPage({ searchParams }: Props) {
  const params = await searchParams;
  // URL クエリ ?node=xxx で指定されていて、かつ実在するノードならそれを初期 current に
  const requestedNodeId =
    params.node && MOCK_TREE.some((n) => n.id === params.node)
      ? params.node
      : null;
  const initialNodeId = requestedNodeId ?? MOCK_CURRENT_NODE_ID;
  // 体系図 復元テストは「1 日の学習の始め」の儀式。担任 chat の
  // 「今日の学習を始める」（/tutor → StartStudyCard）から ?startDay=1
  // で明示的にトリガーされた時のみ表示する。/learn に直接訪れた時
  // （リロード / 履歴 / 直リンク）は表示しない。
  // 注: 担任 chat は ?node=xxx と一緒に ?startDay=1 を渡してくるので、
  // node の有無では判定しない。
  const startDay = params.startDay === "1";
  const skipReconstruction = !startDay;

  return (
    <LearnWorkspace
      user={MOCK_USER}
      subject={MOCK_SUBJECT}
      subjects={MOCK_SUBJECTS}
      materials={MOCK_MATERIALS}
      nodes={MOCK_TREE}
      initialMessages={MOCK_MESSAGES}
      initialNotes={MOCK_NOTES}
      initialIssues={MOCK_ISSUES}
      initialCurrentNodeId={initialNodeId}
      skipReconstruction={skipReconstruction}
      sessionIssueCandidates={MOCK_SESSION_ISSUE_CANDIDATES}
    />
  );
}
