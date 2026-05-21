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
  MOCK_MATERIALS,
  MOCK_MEMOS,
  MOCK_MESSAGES,
  MOCK_NOTES,
  MOCK_SUBJECT,
  MOCK_SUBJECTS,
  MOCK_TREE,
  MOCK_USER,
} from "@/lib/learn/mock-data";

export default function LearnPage() {
  return (
    <LearnWorkspace
      user={MOCK_USER}
      subject={MOCK_SUBJECT}
      subjects={MOCK_SUBJECTS}
      materials={MOCK_MATERIALS}
      nodes={MOCK_TREE}
      initialMessages={MOCK_MESSAGES}
      initialNotes={MOCK_NOTES}
      initialMemos={MOCK_MEMOS}
      initialCurrentNodeId={MOCK_CURRENT_NODE_ID}
    />
  );
}
