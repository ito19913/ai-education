"use server";

/**
 * C-8: スキャン本 まとまり区切り — Server Action 薄皮 (2026-06-06)
 *
 * 中核ロジックは segment-scan-core.ts に分離 (2026-06-13、まとまり生成ジョブ化)。
 * ここは requireUser ガードを付けてユーザー文脈 (scan-segment-builder、ブラウザ) から
 * 呼ぶための薄皮。Cron ワーカーは segment-scan-core を直接 import する。
 */

import { requireUser } from "@/lib/supabase/require-user";
import {
  regroupTocIntoSegmentsCore,
  readPrintedPageNumbersCore,
  segmentScanByVisionCore,
  type RegroupTocInput,
  type RegroupedSegment,
  type ScanVisionInput,
  type ScanVisionSegment,
  type TocNodeForGrouping,
} from "@/lib/ai/segment-scan-core";

export type {
  RegroupTocInput,
  RegroupedSegment,
  ScanVisionInput,
  ScanVisionSegment,
  TocNodeForGrouping,
};

export async function regroupTocIntoSegments(
  input: RegroupTocInput,
): Promise<RegroupedSegment[]> {
  await requireUser();
  return regroupTocIntoSegmentsCore(input);
}

export async function readPrintedPageNumbers(
  imagesPacked: string,
): Promise<Array<number | null>> {
  await requireUser();
  return readPrintedPageNumbersCore(imagesPacked);
}

export async function segmentScanByVision(
  input: ScanVisionInput,
): Promise<ScanVisionSegment[]> {
  await requireUser();
  return segmentScanByVisionCore(input);
}
