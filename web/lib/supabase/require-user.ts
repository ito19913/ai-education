/**
 * Server Action の認証ガード (2026-06-12 セキュリティレビュー指摘 1)。
 *
 * Server Action ("use server" の export 関数) は middleware のルート保護とは別に、
 * 公開パスへの POST で直接実行できてしまう。Claude API を呼ぶ action が無防備だと、
 * 未認証の第三者に Opus + vision を呼び放題にされる (API コスト被害)。
 * → 全 Server Action の先頭で本ガードを呼び、未ログインなら throw する。
 *
 * mock モード (Supabase 未設定のローカル開発) は認証基盤そのものが無いのでスキップ
 * (= 既存の mock フォールバック動線を壊さない)。
 */
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";

export async function requireUser(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthenticated: ログインしてから使ってね");
  }
}
