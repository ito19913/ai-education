/**
 * 宣言パレット (R11-② 書く型、2026-06-11 grill R11-4 確定、client 用)
 *
 * 「宣言」= 文章をだらっと書かない。中身に名前を付けてから書く (【定義】【要件】【効果】…)。
 * - 科目別の既定セット (タップでレジュメ本文に挿入するチップ)
 * - 子が自作した宣言は科目のパレットに蓄積 (R11-4「自作可」。MVP は localStorage 永続化、
 *   端末をまたぐ必要が出たら DB 昇格)
 */

/** 科目別の既定宣言セット。ハードコード 5 教科は id で、カスタム科目は名前で推定。 */
export function defaultDeclarations(
  subjectId: string,
  subjectName: string,
): string[] {
  switch (subjectId) {
    case "subj-english":
      return ["ルール", "形", "意味", "例文", "例外", "注意"];
    case "subj-math":
      return ["定義", "公式", "手順", "例題", "注意"];
    case "subj-japanese":
      return ["定義", "ポイント", "例", "注意"];
    case "subj-science":
      return ["定義", "しくみ", "公式", "実験", "注意"];
    case "subj-social":
      return ["定義", "背景", "流れ", "ポイント", "注意"];
    default:
      break;
  }
  // カスタム科目: 法律・税務・会計系は ito19 さんの会計士レジュメの型 (定義/要件/効果/論点)
  if (/法|税|簿記|会計|商業|民|憲/.test(subjectName)) {
    return ["定義", "趣旨", "要件", "効果", "論点", "例"];
  }
  return ["定義", "ポイント", "理由", "例", "注意"];
}

const STORAGE_KEY_PREFIX = "ai-edu-declarations:";

/** 子が自作した宣言 (科目スコープ、localStorage)。 */
export function loadCustomDeclarations(subjectId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + subjectId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** 自作宣言を科目パレットに追加して保存。追加後の全カスタム宣言を返す。 */
export function addCustomDeclaration(
  subjectId: string,
  label: string,
): string[] {
  const cleaned = label.trim().replace(/^【|】$/g, "").slice(0, 12);
  const current = loadCustomDeclarations(subjectId);
  if (!cleaned || current.includes(cleaned)) return current;
  const next = [...current, cleaned];
  try {
    window.localStorage.setItem(
      STORAGE_KEY_PREFIX + subjectId,
      JSON.stringify(next),
    );
  } catch {
    // localStorage 不可でもセッション内では使えるよう next を返す
  }
  return next;
}

/** 既定 + 自作をマージしたパレット (重複除去、既定が先)。 */
export function allDeclarations(
  subjectId: string,
  subjectName: string,
  custom: string[],
): string[] {
  const base = defaultDeclarations(subjectId, subjectName);
  return [...base, ...custom.filter((c) => !base.includes(c))];
}

/** flag off / AI 失敗時の固定テンプレ (宣言と番号枠だけ、中身なし = R3 整合)。 */
export function buildFallbackTemplate(
  subjectId: string,
  subjectName: string,
): string {
  const decls = defaultDeclarations(subjectId, subjectName);
  const a = decls[0] ?? "定義";
  const b = decls[1] ?? "ポイント";
  const c = decls[decls.length - 1] ?? "注意";
  return `(1)【${a}】\n\n(2)【${b}】\n①\n②\n\n(3)【${c}】\n`;
}
