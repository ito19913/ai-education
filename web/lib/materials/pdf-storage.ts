/**
 * PDF Storage 層 (段階1-B、2026-06-05、client 用)
 *
 * 元 PDF (最大 186MB の自炊スキャン) を Supabase Storage バケット `material-pdfs` に
 * 出し入れする。186MB は Server Action 経由 (Vercel 関数の body 上限) では通せないので、
 * **ブラウザから TUS 再開可能アップロード**で直接送る。
 *
 * オブジェクトパス規約 = `${ownerId}/${materialId}.pdf` (先頭フォルダ = owner_id、
 * Storage RLS が先頭フォルダで本人/admin を判定する)。
 */
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "material-pdfs";

/** Storage 上のオブジェクトパスを組み立てる。 */
export function materialPdfPath(ownerId: string, materialId: string): string {
  return `${ownerId}/${materialId}.pdf`;
}

/**
 * PDF を TUS 再開可能アップロードで Storage に保存する。
 * @param onProgress 0..1 の進捗 (UI 表示用、任意)
 * @returns 保存先パスとバイトサイズ
 */
export async function uploadMaterialPdf(
  ownerId: string,
  materialId: string,
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<{ path: string; size: number }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("未ログインのため PDF をアップロードできません");

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const path = materialPdfPath(ownerId, materialId);

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${projectUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: BUCKET,
        objectName: path,
        contentType: "application/pdf",
        cacheControl: "3600",
      },
      // Supabase Storage の TUS は chunkSize 必須・6MB 固定。
      chunkSize: 6 * 1024 * 1024,
      onError: (err) => reject(err),
      onProgress: (sent, total) => {
        if (total > 0) onProgress?.(sent / total);
      },
      onSuccess: () => resolve(),
    });
    // 中断したアップロードがあれば再開する。
    void upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });

  return { path, size: file.size };
}

/**
 * Storage から PDF をダウンロードして File に戻す。
 * 読書ビューが session-pdf-store に無い時に呼ぶ (リロード後の復元)。
 */
export async function downloadMaterialPdf(path: string): Promise<File> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    throw error ?? new Error("PDF が見つかりません");
  }
  const fileName = path.split("/").pop() ?? "material.pdf";
  return new File([data], fileName, { type: "application/pdf" });
}

/** Storage から PDF 実体を削除する (教材削除時、コスト優先)。 */
export async function removeMaterialPdf(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
