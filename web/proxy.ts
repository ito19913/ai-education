/**
 * Next.js 16 proxy（旧 middleware）。各リクエストで Supabase のセッションを最新化する。
 * 静的アセットは除外する。
 *
 * Next.js 16 から `middleware.ts` は deprecated、`proxy.ts` に名前変更された。
 * 中身の updateSession ヘルパーは `lib/supabase/middleware.ts` のままにしてある
 * （内部ヘルパーで意味は変わらないため）。
 */
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 以下を除外してマッチ:
     * - _next/static (静的ファイル)
     * - _next/image (Image Optimization)
     * - favicon.ico
     * - 拡張子付きの公開アセット (画像・worker など)
     *   mjs/js は pdf.js worker (public/pdf.worker.min.mjs) を認証で弾かないために除外
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs|js)$).*)",
  ],
};
