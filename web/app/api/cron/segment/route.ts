/**
 * まとまり生成 Cron ワーカー (2026-06-13、grill 確定)
 *
 * Supabase pg_cron が毎分この Route Handler を叩く (Authorization: Bearer CRON_SECRET)。
 * segmentation_jobs から 1 ジョブを claim し、関数の制限時間 (maxDuration) 内で
 * できるだけ処理を進める:
 *   - digital 本: 本文テキスト → Haiku 1 回 → 完走 (1 tick)。
 *   - scan 本   : cursor から数チャンクをページ画像化 (PDF-N 焼き込み) → vision で区切り
 *                 → partial_segments に貯める。全ページ終えたら一括マージして完走。
 *
 * 状態は materials.segment_status で見せる (queued/processing は「準備中」、完走で ready、
 * 最終失敗で failed)。走行中は materials.concept_segments を触らない (完走時に原子差し替え)。
 */

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  loadPdfDocumentNode,
  packFullPageTextsNode,
  renderPageToJpegBase64Node,
} from "@/lib/pdf/pdf-node";
import { segmentConceptsFromTextCore } from "@/lib/ai/segment-core";
import {
  segmentScanByVisionCore,
  mergeScanVisionSegments,
  type ScanVisionSegment,
} from "@/lib/ai/segment-scan-core";

export const maxDuration = 120;

// scan: 1 vision 呼び出しに渡す連続ページ数 (serverless のメモリ/時間に配慮し browser の 24 より小さめ)。
const VISION_CHUNK_PAGES = 16;
const VISION_LONG_EDGE = 1000;
const VISION_QUALITY = 0.6;
// 巨大本の暴走防止 (超過分は打ち切り)。
const MAX_VISION_TOTAL_PAGES = 400;
// 1 tick で使う処理時間の上限 (関数 120s のうち余裕を残す)。これを超えたら次 tick に継ぐ。
const TICK_BUDGET_MS = 90_000;

// デフォルト科目 (ハードコード 5 教科) の id→名 (プロンプトの文脈用、最小依存で複製)。
const DEFAULT_SUBJECT_NAMES: Record<string, string> = {
  "subj-english": "英語",
  "subj-math": "数学",
  "subj-japanese": "国語",
  "subj-science": "理科",
  "subj-social": "社会",
};

type JobRow = {
  id: string;
  material_id: string;
  owner_id: string;
  kind: string;
  status: string;
  total_pages: number;
  cursor: number;
  partial_segments: ScanVisionSegment[];
  attempts: number;
};

type MaterialRow = {
  id: string;
  name: string;
  subject_id: string;
  grade_level: string | null;
  pdf_path: string | null;
};

export async function POST(req: Request): Promise<Response> {
  // Cron 認証 (pg_cron → pg_net が Bearer CRON_SECRET を送る)。
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // 1) ジョブを 1 件 claim (FOR UPDATE SKIP LOCKED + lease、RPC)。
  const { data: claimed, error: claimErr } = await supabase.rpc(
    "claim_segmentation_job",
  );
  if (claimErr) {
    console.error("[cron/segment] claim 失敗:", claimErr);
    return Response.json({ error: "claim failed" }, { status: 500 });
  }
  const job = claimed as JobRow | null;
  if (!job || !job.id) {
    return Response.json({ idle: true }); // 処理対象なし
  }

  try {
    // 2) 教材を取得 (owner は job 行から押印して二重縛り)。
    const { data: matData, error: matErr } = await supabase
      .from("materials")
      .select("id, name, subject_id, grade_level, pdf_path")
      .eq("id", job.material_id)
      .eq("owner_id", job.owner_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (matErr) throw matErr;
    const material = matData as MaterialRow | null;
    if (!material || !material.pdf_path) {
      return await failJob(supabase, job, "教材または PDF が見つかりません");
    }

    const subjectName =
      DEFAULT_SUBJECT_NAMES[material.subject_id] ??
      (await resolveSubjectName(supabase, material.subject_id));
    const gradeLevel = material.grade_level ?? "中2";

    // 3) PDF を Storage から取得 (service-role)。
    const { data: blob, error: dlErr } = await supabase.storage
      .from("material-pdfs")
      .download(material.pdf_path);
    if (dlErr || !blob) throw dlErr ?? new Error("PDF download returned empty");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const loaded = await loadPdfDocumentNode(bytes);
    try {
      // 4) 種別判定 (初回 tick のみ)。digital はここで packedText も得る。
      let kind = job.kind;
      let totalPages = job.total_pages;
      let packedText = "";
      if (kind === "unknown") {
        const peek = await packFullPageTextsNode(loaded.doc);
        kind = peek.hasTextLayer ? "digital" : "scan";
        totalPages = peek.numPages;
        packedText = peek.packedText;
        await supabase
          .from("segmentation_jobs")
          .update({ kind, total_pages: totalPages })
          .eq("id", job.id);
      }

      // 5a) digital: 1 tick で完走。
      if (kind === "digital") {
        if (!packedText) {
          const peek = await packFullPageTextsNode(loaded.doc);
          packedText = peek.packedText;
        }
        const segments = await segmentConceptsFromTextCore({
          materialName: material.name,
          subjectName,
          gradeLevel,
          packedText,
        });
        await completeJob(supabase, job, segments);
        return Response.json({ done: true, kind: "digital", count: segments.length });
      }

      // 5b) scan: cursor から時間予算いっぱいチャンクを進める。
      const cap = Math.min(totalPages, MAX_VISION_TOTAL_PAGES);
      const partial: ScanVisionSegment[] = Array.isArray(job.partial_segments)
        ? [...job.partial_segments]
        : [];
      let cursor = job.cursor;
      const startedAt = Date.now();

      while (cursor <= cap && Date.now() - startedAt < TICK_BUDGET_MS) {
        const end = Math.min(cursor + VISION_CHUNK_PAGES - 1, cap);
        const imgs: string[] = [];
        for (let p = cursor; p <= end; p++) {
          const img = await renderPageToJpegBase64Node(
            loaded.doc,
            p,
            VISION_LONG_EDGE,
            VISION_QUALITY,
            `PDF-${p}`,
          );
          if (img) imgs.push(img);
        }
        if (imgs.length > 0) {
          const chunk = await segmentScanByVisionCore({
            materialName: material.name,
            subjectName,
            gradeLevel,
            imagesPacked: imgs.join("\n"),
            startPdfPage: cursor,
          });
          partial.push(...chunk);
        }
        cursor = end + 1;
      }

      if (cursor > cap) {
        // 全ページ終了 → 一括マージして完走。
        const segments = mergeScanVisionSegments(partial);
        await completeJob(supabase, job, segments);
        return Response.json({ done: true, kind: "scan", count: segments.length });
      }

      // 未完 → 進捗を保存して queued に戻す (次 tick が続きを掴む)。
      await supabase
        .from("segmentation_jobs")
        .update({
          status: "queued",
          cursor,
          partial_segments: partial,
          lease_until: null,
        })
        .eq("id", job.id);
      return Response.json({
        progress: true,
        kind: "scan",
        cursor,
        total: cap,
      });
    } finally {
      await loaded.destroy();
    }
  } catch (err) {
    console.error("[cron/segment] 処理失敗:", err);
    // attempts は claim 時に +1 済み。上限に達したら最終失敗、未満ならリトライ (lease 満了で再 claim)。
    const message = err instanceof Error ? err.message : String(err);
    if (job.attempts >= 5) {
      await failJob(supabase, job, message);
    } else {
      await supabase
        .from("segmentation_jobs")
        .update({ last_error: message })
        .eq("id", job.id);
    }
    return Response.json({ error: "job failed", retry: job.attempts < 5 });
  }
}

/** 完走: materials を原子差し替え + job 削除 (RPC)。 */
async function completeJob(
  supabase: ReturnType<typeof createServiceRoleClient>,
  job: JobRow,
  segments: unknown[],
): Promise<void> {
  const { error } = await supabase.rpc("complete_segmentation_job", {
    p_job_id: job.id,
    p_material_id: job.material_id,
    p_owner_id: job.owner_id,
    p_segments: segments,
  });
  if (error) throw error;
}

/** 最終失敗: job を failed、materials も failed バッジに。 */
async function failJob(
  supabase: ReturnType<typeof createServiceRoleClient>,
  job: JobRow,
  message: string,
): Promise<Response> {
  await supabase
    .from("segmentation_jobs")
    .update({ status: "failed", last_error: message })
    .eq("id", job.id);
  await supabase
    .from("materials")
    .update({ segment_status: "failed" })
    .eq("id", job.material_id)
    .eq("owner_id", job.owner_id);
  return Response.json({ failed: true });
}

/** カスタム科目 (uuid) の名前を subjects テーブルから引く。失敗/未登録は「教科」。 */
async function resolveSubjectName(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subjectId: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from("subjects")
      .select("name")
      .eq("id", subjectId)
      .maybeSingle();
    const name = (data as { name?: string } | null)?.name;
    return name && name.length > 0 ? name : "教科";
  } catch {
    return "教科";
  }
}
