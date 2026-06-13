/**
 * まとまり生成サーバー側ジョブの ON/OFF フラグ (2026-06-13)
 *
 * OFF (既定): 従来どおりブラウザでまとまり生成 (runPdfBackgroundWork / 読書ビューの
 *   オンデマンド effect)。
 * ON: 登録/区切り直すでサーバージョブを enqueue し、生成はブラウザで行わない。
 *   本棚バッジ・読書ビュー「準備中」で状態を見せる。
 *
 * ★ON にするのは、ユーザー側のインフラ設定 (SUPABASE_SERVICE_ROLE_KEY / CRON_SECRET /
 *   pg_cron・pg_net 有効化 / GUC 設定 / migration 適用) を済ませ、デプロイした worker が
 *   実機で動くことを確認してから★ (それまでは OFF でブラウザ生成のまま安全に動く)。
 *
 * 切り替え: 環境変数 NEXT_PUBLIC_USE_SEGMENT_JOBS=true。NEXT_PUBLIC_ なのでクライアントでも
 * 参照できる (enqueue・UI 分岐がクライアント側のため)。
 */
export function isSegmentJobsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_SEGMENT_JOBS === "true";
}
