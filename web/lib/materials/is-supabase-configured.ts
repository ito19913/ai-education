/**
 * Supabase が設定済み (= 本番 real モード) かどうかの共通判定 (段階1-B、2026-06-05)。
 *
 * real モード  → 教材一覧は DB から取得、PDF は Storage に永続化。
 * mock モード  → MOCK_MATERIALS をフォールバック表示、リロードで消える割り切り。
 *
 * 判定は `NEXT_PUBLIC_SUPABASE_URL` の有無。env が空文字列で注入されるケース
 * (親 harness の injection、ANTHROPIC_API_KEY で踏んだ問題の Supabase 版) も
 * 「未設定」として mock 扱いにするため、trim して長さで見る。
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key && url.startsWith("http"));
}
