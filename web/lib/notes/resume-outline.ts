/**
 * レジュメ冊アウトラインの client ユーティリティ (R11-①、2026-06-11 grill 確定)
 *
 * - toRoman: 章番号のローマ数字表示 (R11-3: Ⅰ→1→(1)→①→・ を表示時に固定レンダリング)
 * - sanitizeOutline: AI 出力 (sections) を検証して ResumeOutlineSection[] に正規化
 *   (実在しない/重複した entryId を除去、章 id をクライアントで採番)
 * - buildFallbackOutline: Claude flag off / 失敗時の素朴な章立て (教材ごとに 1 章、ページ順)
 */
import { parsePageRange } from "@/lib/notes/concept-for-page";
import type { NoteEntry, ResumeOutlineSection } from "@/lib/learn/types";

/** 1-based の数値をローマ数字に (Ⅰ〜。章数想定なので 1〜50 で十分)。 */
export function toRoman(n: number): string {
  if (n <= 0) return String(n);
  const table: Array<[number, string]> = [
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = n;
  let out = "";
  for (const [v, s] of table) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

/** AI 出力の生 sections (title + entryIds) 想定形。 */
export type RawOutlineSections = {
  sections: Array<{ title?: unknown; entryIds?: unknown }>;
};

/**
 * AI 出力を検証して正規化する。
 * - 章 id はここで採番 ("sec-1"…)
 * - entryIds は「この冊に実在するピース」かつ「初出」だけ残す (1 ピース 1 箇所、R11-1)
 * - タイトル空の章・中身の判定はしない (空章も子の意図がありうるので残す)
 */
export function sanitizeOutline(
  raw: unknown,
  entries: NoteEntry[],
): ResumeOutlineSection[] {
  const sectionsRaw = (raw as RawOutlineSections | null)?.sections;
  if (!Array.isArray(sectionsRaw)) return [];
  const valid = new Set(entries.map((e) => e.id));
  const used = new Set<string>();
  const out: ResumeOutlineSection[] = [];
  for (const s of sectionsRaw) {
    const title =
      typeof s?.title === "string" ? s.title.trim().slice(0, 60) : "";
    if (!title) continue;
    const ids: string[] = [];
    if (Array.isArray(s.entryIds)) {
      for (const id of s.entryIds) {
        if (typeof id !== "string") continue;
        if (!valid.has(id) || used.has(id)) continue;
        used.add(id);
        ids.push(id);
      }
    }
    out.push({ id: `sec-${out.length + 1}`, title, entryIds: ids });
  }
  return out;
}

/**
 * フォールバックの章立て: 出典教材ごとに 1 章 (章タイトル = 教材名)、章内はページ順。
 * 教材なしピースは「その他」章へ。
 */
export function buildFallbackOutline(
  entries: NoteEntry[],
  materialNameOf: (materialId: string) => string | null,
): ResumeOutlineSection[] {
  const groups = new Map<string, { title: string; entries: NoteEntry[] }>();
  for (const e of entries) {
    const key = e.sourceMaterialId ?? "__none__";
    const title =
      (e.sourceMaterialId ? materialNameOf(e.sourceMaterialId) : null) ??
      "その他";
    const g = groups.get(key) ?? { title, entries: [] };
    g.entries.push(e);
    groups.set(key, g);
  }
  const startPageOf = (e: NoteEntry) =>
    parsePageRange(e.sourcePageRange)?.start ?? Number.MAX_SAFE_INTEGER;
  return [...groups.values()].map((g, i) => ({
    id: `sec-${i + 1}`,
    title: g.title,
    entryIds: [...g.entries]
      .sort((a, b) => startPageOf(a) - startPageOf(b))
      .map((e) => e.id),
  }));
}

/** アウトラインのどの章にも配置されていないピース (= 通し文書の「未整理」)。 */
export function unplacedEntries(
  outline: ResumeOutlineSection[] | undefined,
  entries: NoteEntry[],
): NoteEntry[] {
  if (!outline || outline.length === 0) return entries;
  const placed = new Set(outline.flatMap((s) => s.entryIds));
  return entries.filter((e) => !placed.has(e.id));
}
