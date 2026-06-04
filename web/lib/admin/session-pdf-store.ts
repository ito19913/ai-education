/**
 * セッション PDF ストア (段階1-C「一緒にめくって読む」、2026-06-04)
 *
 * アップロードした教材 PDF の File を、**ブラウザのセッション中だけ** in-memory で
 * 保持する。読書ビュー (MaterialReadPane) が任意ページを描画して葵に vision で
 * 見せるために、登録後も PDF 本体が必要なため。
 *
 * 割り切り (grill 確定):
 * - モジュールレベルの Map なので SPA 遷移では生き残るが、**ページ再読み込みで消える**。
 * - 永続化は別途 1-B (Supabase Storage) で対応。今は今セッション登録分のみ「一緒に読む」可能。
 *
 * Material.id をキーにする。File は SSR では存在しないが、本ストアは client 専用に使う。
 */

const store = new Map<string, File>();

/** 教材 ID に PDF File を紐付けて保持する (登録完了時に呼ぶ)。 */
export function setSessionPdf(materialId: string, file: File): void {
  store.set(materialId, file);
}

/** 教材 ID の PDF File を取得する。無ければ undefined (= 今セッションで登録していない)。 */
export function getSessionPdf(materialId: string): File | undefined {
  return store.get(materialId);
}

/** 教材 ID の PDF File が保持されているか。 */
export function hasSessionPdf(materialId: string): boolean {
  return store.has(materialId);
}
