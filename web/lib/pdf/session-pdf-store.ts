/**
 * セッション PDF ストア (段階1-C「一緒にめくって読む」、2026-06-04)
 *
 * アップロードした教材 PDF の File を、**ブラウザのセッション中だけ** in-memory で
 * 保持する。読書ビュー (MaterialReadPane) が任意ページを描画して葵に vision で
 * 見せるために、登録後も PDF 本体が必要なため。
 *
 * 割り切り (grill 確定):
 * - モジュールレベルの Map なので SPA 遷移では生き残るが、**ページ再読み込みで消える**。
 * - 永続化は 1-B (Supabase Storage)。Storage から復元した File もここに入る。
 *
 * LRU (2026-06-12 レビュー Phase 2): Storage フォールバックで取得した File は
 * メモリ常駐の Blob (自炊本は 186MB 級) なので、無制限に溜めると教材を開くたびに
 * N × 186MB 積み上がる。最近使った順に保持し、バイト予算 or 件数上限を超えたら
 * 古いものから捨てる (捨てても Storage から再取得できるだけで壊れない)。
 *
 * Material.id をキーにする。File は SSR では存在しないが、本ストアは client 専用に使う。
 */

// バイト予算: 巨大自炊本 2 冊分くらいまで。超えたら古い方から evict (最低 1 件は残す)。
const MAX_TOTAL_BYTES = 400 * 1024 * 1024;
// 件数上限: 小さい PDF ばかりでも無制限には溜めない。
const MAX_ENTRIES = 8;

// Map は挿入順を保つ → 「再挿入で末尾へ」で LRU を表現する (先頭が最も古い)。
const store = new Map<string, File>();

function evictOverBudget(): void {
  let totalBytes = 0;
  for (const f of store.values()) totalBytes += f.size;
  while (
    store.size > 1 &&
    (store.size > MAX_ENTRIES || totalBytes > MAX_TOTAL_BYTES)
  ) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = store.get(oldestKey);
    store.delete(oldestKey);
    totalBytes -= oldest?.size ?? 0;
  }
}

/** 教材 ID に PDF File を紐付けて保持する (登録完了時 / Storage 復元時に呼ぶ)。 */
export function setSessionPdf(materialId: string, file: File): void {
  store.delete(materialId);
  store.set(materialId, file);
  evictOverBudget();
}

/** 教材 ID の PDF File を取得する。無ければ undefined (= 未登録 or LRU で破棄済み)。 */
export function getSessionPdf(materialId: string): File | undefined {
  const file = store.get(materialId);
  if (file) {
    // touch: 最近使ったものとして末尾へ移す
    store.delete(materialId);
    store.set(materialId, file);
  }
  return file;
}

/** 教材 ID の PDF File が保持されているか。 */
export function hasSessionPdf(materialId: string): boolean {
  return store.has(materialId);
}
