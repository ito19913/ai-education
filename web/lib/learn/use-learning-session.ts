"use client";

/**
 * useLearningSession - 学習セッションを管理する hook（pause/resume 対応版）。
 *
 * 状態モデル: "active" | "paused" | "ended"
 *
 * 自動振る舞い:
 *   - mount: active で開始
 *   - 一定時間（idleTimeoutMs）操作なし → **自動 pause**（旧版は終了だった）
 *   - 任意の操作（mouse / keyboard / click / scroll / touch）で **自動 resume**
 *     （throttle 1 秒）
 *   - 明示的に endSession() を呼ぶ → ended（ゆいに報告して終了するフロー用）
 *   - ブラウザ閉じる時（beforeunload）に確認
 *
 * 経過時間（elapsedSec）:
 *   - active の累積秒数のみカウント
 *   - paused 中は止まる（再開で続き）
 *   - ended で確定
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionEndReason } from "./types";

export type SessionStatus = "active" | "paused" | "ended";

export type UseLearningSessionResult = {
  startedAt: string;
  endedAt: string | null;
  pausedAt: string | null;
  status: SessionStatus;
  elapsedSec: number;
  /** @deprecated status === "active" を使うほうが分かりやすい */
  isActive: boolean;
  endReason: SessionEndReason | null;
  endSession: (reason: SessionEndReason) => void;
  /** 手動で pause/resume したい時用（通常は自動検知に任せて呼ばなくて OK）*/
  pause: () => void;
  resume: () => void;
  /**
   * @deprecated global 活動リスナーが拾うので明示呼び出しは不要。
   * 後方互換のため残す（呼ぶと idle タイマーがリセットされる + paused なら resume）。
   */
  markActivity: () => void;
};

type Options = {
  /** 自動 pause する idle 時間 (ms)。デフォルト 15 分 */
  idleTimeoutMs?: number;
};

export function useLearningSession({
  idleTimeoutMs = 15 * 60 * 1000,
}: Options = {}): UseLearningSessionResult {
  const [startedAt] = useState(() => new Date().toISOString());
  // Date.now() は impure なので useState の lazy initializer に閉じ込めて
  // mount 時 1 回だけ実行 → そこから ref を初期化（react-hooks/purity 対応）。
  const [mountTimeMs] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // active 区間の累積秒数（pause/end 時に確定加算）
  const activeAccumSecRef = useRef(0);
  // 現在の active 区間の開始時刻 (paused/ended 中は null)
  const lastActiveStartRef = useRef<number | null>(mountTimeMs);
  // 最終活動時刻 (idle 検知用)
  const lastActivityRef = useRef(mountTimeMs);
  // 終了済みフラグ (idempotent な endSession のため)
  const endedRef = useRef(false);

  const status: SessionStatus = endedAt ? "ended" : pausedAt ? "paused" : "active";

  // 経過秒数の最新値を計算（active なら現在進行中の区間も加算）
  const computeElapsed = (): number => {
    const accum = activeAccumSecRef.current;
    const start = lastActiveStartRef.current;
    if (start !== null) {
      return Math.floor(accum + (Date.now() - start) / 1000);
    }
    return Math.floor(accum);
  };

  const pause = useCallback(() => {
    if (endedRef.current) return;
    if (lastActiveStartRef.current === null) return; // 既に paused
    // 現在進行中の active 区間を累積に確定
    const additional =
      (Date.now() - lastActiveStartRef.current) / 1000;
    activeAccumSecRef.current += additional;
    lastActiveStartRef.current = null;
    setPausedAt(new Date().toISOString());
    setElapsedSec(Math.floor(activeAccumSecRef.current));
  }, []);

  const resume = useCallback(() => {
    if (endedRef.current) return;
    if (lastActiveStartRef.current !== null) return; // 既に active
    lastActiveStartRef.current = Date.now();
    lastActivityRef.current = Date.now();
    setPausedAt(null);
    // elapsed は次の tick で進む（resume 直後は変わらない値）
  }, []);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (lastActiveStartRef.current === null && !endedRef.current) {
      // paused 中の活動 → resume
      resume();
    }
  }, [resume]);

  const endSession = useCallback((reason: SessionEndReason) => {
    if (endedRef.current) return;
    endedRef.current = true;
    // 現在 active なら累積に加算
    if (lastActiveStartRef.current !== null) {
      const additional =
        (Date.now() - lastActiveStartRef.current) / 1000;
      activeAccumSecRef.current += additional;
      lastActiveStartRef.current = null;
    }
    setEndedAt(new Date().toISOString());
    setEndReason(reason);
    setElapsedSec(Math.floor(activeAccumSecRef.current));
    // 後で Supabase に書き込み or LocalStorage 保存。MVP は console.log。
    console.log("[session-end]", { reason });
  }, []);

  // tick + idle 検知 (毎秒)
  useEffect(() => {
    if (endedAt) return;
    const interval = window.setInterval(() => {
      // elapsed を更新（active なら進行中の区間を含めて再計算）
      setElapsedSec(computeElapsed());
      // idle 検知: active かつ最終活動から idleTimeoutMs 経過 → auto-pause
      if (
        lastActiveStartRef.current !== null &&
        Date.now() - lastActivityRef.current > idleTimeoutMs
      ) {
        pause();
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [endedAt, idleTimeoutMs, pause]);

  // global 活動リスナー (throttle 1 秒)
  useEffect(() => {
    if (endedAt) return;
    let lastFireMs = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastFireMs < 1000) return;
      lastFireMs = now;
      markActivity();
    };
    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
  }, [endedAt, markActivity]);

  // beforeunload: ブラウザ閉じる時に確認
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (endedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return {
    startedAt,
    endedAt,
    pausedAt,
    status,
    elapsedSec,
    isActive: status === "active",
    endReason,
    endSession,
    pause,
    resume,
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
