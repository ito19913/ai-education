/**
 * Server Component / Route Handler / Server Action から使う Supabase クライアント。
 * Next.js のクッキー越しにセッションを共有する。
 *
 * 使い方（Server Component）:
 *   import { createClient } from "@/lib/supabase/server";
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component から set が呼ばれた場合の握り潰し。
            // middleware でセッション更新するのでここで失敗しても問題ない。
          }
        },
      },
    },
  );
}
