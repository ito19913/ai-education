/**
 * ブラウザ（Client Component）から使う Supabase クライアント。
 * RLS が効くので、ユーザーが自分のデータしか触れない。
 *
 * 使い方:
 *   "use client";
 *   import { createClient } from "@/lib/supabase/client";
 *   const supabase = createClient();
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
