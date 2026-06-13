"use server";

/**
 * まとまり (一単元 = 1 概念) 区切り AI 抽出 — Server Action 薄皮 (M1-M10、2026-06-06)
 *
 * 中核ロジックは segment-core.ts に分離 (2026-06-13、まとまり生成ジョブ化)。
 * ここは requireUser ガードを付けてユーザー文脈から呼ぶための薄皮。Cron ワーカーは
 * セッションを持たないので segment-core を直接 import する (requireUser を通さない)。
 */

import { requireUser } from "@/lib/supabase/require-user";
import {
  segmentConceptsFromTextCore,
  type SegmentFromTextInput,
} from "@/lib/ai/segment-core";
import type { ConceptSegment } from "@/lib/learn/types";

export type { SegmentFromTextInput };

export async function segmentConceptsFromText(
  input: SegmentFromTextInput,
): Promise<ConceptSegment[]> {
  await requireUser();
  return segmentConceptsFromTextCore(input);
}
