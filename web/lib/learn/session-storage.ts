"use client";

/**
 * 学習セッションの localStorage 永続化レイヤー。
 *
 * 設計（ito19 さん確定 2026-05-24）:
 *   - ブラウザ閉じ ≠ 学習終了。state を localStorage に保存。
 *   - 同日内に戻ってきたら自動復元（pause 状態で起動、活動で resume）。
 *   - 別日に戻ってきたら **完全サイレントで破棄**、新規セッション開始。
 *     ゆい先生も過去には触れない（しつこくない）。
 *   - 1 週間サボっても何も聞かれない。普通の朝の振り返りから始まる。
 *
 * Phase 7 で Supabase に置き換える時、この抽象を保ったままバックエンドだけ
 * 差し替えれば良い形にしている。
 */

export type PersistedSession = {
  /** セッション開始時刻 ISO */
  startedAt: string;
  /** active 区間の累積秒数（pause/save 時点の最新値） */
  activeAccumSec: number;
  /** 保存時の状態。ended は永続化しない（明示終了で clear する） */
  status: "active" | "paused";
  /** 保存時刻 ISO。デバッグ・健全性チェック用 */
  savedAt: string;
  /** ローカル日付 YYYY-MM-DD（同日判定用） */
  date: string;
};

const STORAGE_KEY = "ai-education:learning-session";

/** localStorage から復元（壊れてたら null） */
export function loadPersistedSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    // 最低限の整合性チェック
    if (
      typeof parsed.startedAt !== "string" ||
      typeof parsed.activeAccumSec !== "number" ||
      typeof parsed.date !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedSession(s: PersistedSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // QuotaExceeded など。サイレント failure（mock では致命的ではない）
  }
}

export function clearPersistedSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** ローカルタイムゾーンでの YYYY-MM-DD */
export function formatLocalDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSameLocalDate(
  dateStr: string,
  now: Date = new Date(),
): boolean {
  return dateStr === formatLocalDate(now);
}
