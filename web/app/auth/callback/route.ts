import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * マジックリンクのコールバック。
 * メールに届いたリンクは `/auth/callback?code=...` の形式で飛んでくる。
 * code を session に交換して、元の画面へリダイレクトする。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // エラーまたは code 不在ならログイン画面に戻す
  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}
