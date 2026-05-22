"use client";

/**
 * useLearningSession - 学習セッションを管理する hook。
 *
 * - 開始: hook がマウントされた時刻
 * - 終了:
 *   - 明示的に endSession("manual") を呼ぶ
 *   - 一定時間（idleTimeoutMs）操作なしで自動終了 ("auto-idle")
 *   - ブラウザ閉じる時 (beforeunload) で確認
 * - 経過時間: 1 秒ごとに更新
 * - 活動マーク: markActivity を呼ぶたびに idle timer がリセット
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionEndReason } from "./types";

export type UseLearningSessionResult = {
  startedAt: string;
  endedAt: string | null;
  elapsedSec: number;
  isActive: boolean;
  endReason: SessionEndReason | null;
  endSession: (reason: SessionEndReason) => void;
  markActivity: () => void;
};

type Options = {
  /** 自動終了する idle 時間 (ms)。デフォルト 15 分 */
  idleTimeoutMs?: number;
};

export function useLearningSession({
  idleTimeoutMs = 15 * 60 * 1000,
}: Options = {}): UseLearningSessionResult {
  const [startedAt] = useState(() => new Date().toISOString());
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const lastActivityRef = useRef(Date.now());
  const endedRef = useRef(false);

  const endSession = useCallback((reason: SessionEndReason) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEndedAt(new Date().toISOString());
    setEndReason(reason);
    // 後で Supabase に書き込み or LocalStorage 保存。MVP は console.log。
    console.log("[session-end]", { reason });
  }, []);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // 経過時間 + idle 監視
  useEffect(() => {
    if (endedAt) return;
    const start = new Date(startedAt).getTime();
    const interval = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
      if (Date.now() - lastActivityRef.current > idleTimeoutMs) {
        endSession("auto-idle");
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [endedAt, startedAt, idleTimeoutMs, endSession]);

  // beforeunload: ブラウザ閉じる時に確認 + best-effort で終了記録
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (endedRef.current) return;
      // ブラウザにキャンセル可能なダイアログを表示させる
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return {
    startedAt,
    endedAt,
    elapsedSec,
    isActive: !endedAt,
    endReason,
    endSession,
    markActivity,
  };
}

/** 秒数 → "M:SS" or "H:MM:SS" */
export function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
