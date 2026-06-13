import "server-only";

/**
 * Service-role Supabase クライアント (2026-06-13、まとまり生成ジョブ化)
 *
 * Cron ワーカー (app/api/cron/segment) はユーザーセッション (cookie) を持たないため、
 * ANON クライアント + RLS では DB / Storage にアクセスできない。service-role キーで
 * RLS をバイパスする管理クライアントを使う。
 *
 * ## 安全規律 (★必須★)
 * - `import "server-only"` でクライアントバンドルへの混入を防ぐ (キー露出防止)。
 * - RLS をバイパスするので、**owner_id は絶対にリクエスト由来にせず、
 *   segmentation_jobs 行の owner_id から押印する**。materials の更新は
 *   `.eq("id", material_id).eq("owner_id", owner_id)` で二重に縛る。
 * - 読むのは job 行が指す owner/material のパスだけ (任意 owner を触らない)。
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function createServiceRoleClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "service-role クライアント未設定: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です。",
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
