/**
 * middleware からセッションを更新する用のヘルパー。
 * Next.js middleware は edge runtime で動くので、リクエスト/レスポンスのクッキーを介して
 * セッションを最新化する。
 *
 * 使い方: ルートの middleware.ts から呼ぶ。
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 重要: createServerClient と supabase.auth.getUser() の間に処理を挟まない。
  // セッションのリフレッシュタイミングがズレてバグの原因になる。
  await supabase.auth.getUser();

  return supabaseResponse;
}
