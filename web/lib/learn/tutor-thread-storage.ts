"use client";

/**
 * ゆい先生 chat の localStorage 永続化レイヤー（Phase 3 拡張）。
 *
 * 設計（ito19 さん確定 2026-05-24）:
 *   - 1 日 1 thread。日付ごとに保存・復元。
 *   - 同日内: mount 時に load して継続（朝の振り返り → 課題確認 → ... → 学習終了 を 1 本に蓄積）
 *   - 別日: 過去 thread はそのまま archive 残し、今日は新規 thread を作成
 *   - Claude API (Phase 6) コンテキスト管理は 1 thread = 1 日分で bounded
 *
 * Phase 7 で Supabase に差し替えやすい抽象を保つ。
 */

import type { TutorMessage } from "./types";

/** 1 日分の thread + 状態スナップショット */
export type StoredTutorThread = {
  /** ローカル日付 YYYY-MM-DD */
  date: string;
  /** その日のメッセージ全部（時系列） */
  messages: TutorMessage[];
  /** scripted state machine の state 名（mock 用、復元時に発話続行できるように）*/
  state?: string;
  /** ending-vent の蓄積（mock 用、ending フロー中断時に復元できるように）*/
  endingVentItems?: string[];
  /** 保存時刻 ISO（デバッグ用）*/
  savedAt: string;
};

/** localStorage key prefix: 日付ごとに分けて保存 */
const KEY_PREFIX = "ai-education:tutor-thread:";
/** すべての thread 日付を index する key */
const INDEX_KEY = "ai-education:tutor-thread-index";

function key(date: string): string {
  return `${KEY_PREFIX}${date}`;
}

export function loadTutorThread(date: string): StoredTutorThread | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(date));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTutorThread;
    // 最低限の整合性チェック
    if (
      typeof parsed.date !== "string" ||
      !Array.isArray(parsed.messages)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveTutorThread(thread: StoredTutorThread): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(thread.date), JSON.stringify(thread));
    // index に日付を登録
    const index = listTutorThreadDates();
    if (!index.includes(thread.date)) {
      index.push(thread.date);
      index.sort(); // 古い → 新しい
      window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }
  } catch {
    // QuotaExceeded など。サイレント failure
  }
}

/** 保存されている全 thread の日付リスト（古い → 新しい）*/
export function listTutorThreadDates(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d) => typeof d === "string").sort();
  } catch {
    return [];
  }
}

/** 1 日分の thread を削除（テスト・リセット用）。index からも除去。*/
export function deleteTutorThread(date: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(date));
    const index = listTutorThreadDates().filter((d) => d !== date);
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // ignore
  }
}
