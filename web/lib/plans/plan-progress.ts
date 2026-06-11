/**
 * plan-progress - 新プランの進捗導出 (2026-06-10、grill 確定)。
 *
 * プランは完了フラグを持たない。「済み」はレジュメ (note_entries) から導出する:
 *   済み = そのまとまりのレジュメが understood (順不同 OK・プラン作成前の理解済みも有効)
 *          or 手動スキップ (plan.skippedSegmentIds)
 *   先頭 = キュー順 (startPdfPage 昇順、前付け除外) で最初の未済
 *   進捗 = 済み数 / 全まとまり数
 *
 * countFrom (2周目): 値があれば「countFrom 以降に更新された understood」だけ済みに数える。
 * G-C の 2 周目は既存レジュメを更新する (open→understood / 要約深化) ので updated_at が
 * 進み、自然に 2 周目の済みとして数えられる。
 */
import type {
  ConceptSegment,
  Material,
  NoteEntry,
  StudyPlan,
} from "@/lib/learn/types";

/**
 * 「学習内容でない区切り」(表紙・前付け・目次・索引など) の判定。
 * MaterialReadPane / MaterialDetailView の同名ヘルパーと同じ正規表現。
 */
export function isFrontMatterName(name: string): boolean {
  return /表紙|扉|前付|まえがき|はじめに|序文|目次|もくじ|使い方|凡例|奥付|索引|さくいん|著者|広告|後付|あとがき/.test(
    name,
  );
}

/** プランのキュー (= 教材のまとまりを前付け除外 + ページ順)。 */
export function getPlanSegments(material: Material): ConceptSegment[] {
  const segs = material.conceptSegments ?? [];
  return segs
    .filter((s) => !isFrontMatterName(s.conceptName))
    .sort((a, b) => a.startPdfPage - b.startPdfPage);
}

/** このまとまりが「レジュメ理解済み」で済んでいるか (countFrom 考慮)。 */
function doneByResume(
  seg: ConceptSegment,
  plan: StudyPlan,
  notes: NoteEntry[],
): boolean {
  return notes.some((n) => {
    if (n.deletedAt) return false;
    if (n.status !== "understood") return false;
    if (n.sourceMaterialId !== plan.materialId) return false;
    if (n.sourceSegmentId !== seg.id) return false;
    if (plan.countFrom) {
      // 2周目: countFrom 以降に更新されたものだけ数える (updatedAt 不明な行は数えない)
      if (!n.updatedAt || n.updatedAt < plan.countFrom) return false;
    }
    return true;
  });
}

export type SegmentState = "done" | "skipped" | "pending";

export type PlanProgress = {
  /** キュー (前付け除外 + ページ順) */
  segments: ConceptSegment[];
  /** segment.id → 状態 */
  states: Map<string, SegmentState>;
  /** 済み数 (done + skipped) */
  doneCount: number;
  total: number;
  /** 先頭 = 最初の未済 (全部済みなら null) */
  head: ConceptSegment | null;
};

/** プランの進捗を導出する。 */
export function computePlanProgress(
  plan: StudyPlan,
  material: Material,
  notes: NoteEntry[],
): PlanProgress {
  const segments = getPlanSegments(material);
  const skipped = new Set(plan.skippedSegmentIds);
  const states = new Map<string, SegmentState>();
  let doneCount = 0;
  let head: ConceptSegment | null = null;
  for (const seg of segments) {
    let state: SegmentState;
    if (doneByResume(seg, plan, notes)) {
      state = "done";
    } else if (skipped.has(seg.id)) {
      state = "skipped";
    } else {
      state = "pending";
    }
    states.set(seg.id, state);
    if (state !== "pending") doneCount++;
    else if (!head) head = seg;
  }
  return { segments, states, doneCount, total: segments.length, head };
}

/** 期限までの残り日数 (負 = 期限超過)。 */
export function daysUntilEnd(plan: StudyPlan, now?: Date): number {
  const today = now ? new Date(now) : new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(plan.endsAt);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
