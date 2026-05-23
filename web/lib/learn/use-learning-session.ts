"use client";

/**
 * useLearningSession - 学習セッションを管理する hook（pause/resume + 永続化対応版）。
 *
 * 状態モデル: "active" | "paused" | "ended"
 *
 * 自動振る舞い:
 *   - mount: 同日内に未終了セッションが localStorage にあれば **復元 (paused 状態)**、
 *     なければ active で新規開始
 *   - 一定時間（idleTimeoutMs）操作なし → **自動 pause**
 *   - 任意の操作（mouse / keyboard / click / scroll / touch）で **自動 resume**（throttle 1 秒）
 *   - 明示的に endSession() を呼ぶ → ended（ゆいに報告して終了するフロー用） + localStorage clear
 *   - ブラウザ閉じる時（beforeunload）に snapshot を localStorage に保存
 *   - **別日に来た場合は前日以前のセッションを静かに破棄**（ito19 さん指示 2026-05-24）
 *
 * 経過時間（elapsedSec）:
 *   - active の累積秒数のみカウント
 *   - paused 中は止まる（再開で続き）
 *   - ended で確定
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionEndReason } from "./types";
import {
  clearPersistedSession,
  formatLocalDate,
  isSameLocalDate,
  loadPersistedSession,
  savePersistedSession,
  type PersistedSession,
} from "./session-storage";

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
  // mount 時に localStorage チェック + 初期化情報をまとめて 1 回だけ計算。
  // 同日内の persisted session があれば復元（paused 起動）、なければ新規。
  // Date.now() / localStorage アクセスは lazy init に閉じ込める。
  const [init] = useState(() => {
    const persisted = loadPersistedSession();
    const now = Date.now();
    if (persisted && isSameLocalDate(persisted.date)) {
      // 同日内の継続セッション → 復元（paused 起動）
      return {
        startedAt: persisted.startedAt,
        mountTimeMs: now,
        initialAccumSec: persisted.activeAccumSec,
        restored: true as const,
      };
    }
    // 別日 or 未保存 → 新規（古いものは破棄）
    if (persisted) clearPersistedSession();
    return {
      startedAt: new Date(now).toISOString(),
      mountTimeMs: now,
      initialAccumSec: 0,
      restored: false as const,
    };
  });

  const [startedAt] = useState(init.startedAt);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  // 復元時は paused 起動（活動で resume）。新規は null。
  // lazy initializer 形にして lint 上もクリーンに（render 中の純粋性確保）。
  const [pausedAt, setPausedAt] = useState<string | null>(() =>
    init.restored ? new Date(init.mountTimeMs).toISOString() : null,
  );
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null);
  const [elapsedSec, setElapsedSec] = useState(
    Math.floor(init.initialAccumSec),
  );

  // active 区間の累積秒数（pause/end 時に確定加算）
  const activeAccumSecRef = useRef(init.initialAccumSec);
  // 現在の active 区間の開始時刻 (paused/ended 中は null)
  // 復元時は paused なので null から始まる。
  const lastActiveStartRef = useRef<number | null>(
    init.restored ? null : init.mountTimeMs,
  );
  // 最終活動時刻 (idle 検知用)
  const lastActivityRef = useRef(init.mountTimeMs);
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

  /**
   * 現在 state を localStorage 永続化用にスナップショット。
   * useCallback で安定化（useEffect の deps 警告回避 + 不要な再生成防止）。
   */
  const buildSnapshot = useCallback((): PersistedSession => {
    const isPaused = lastActiveStartRef.current === null;
    const additional = isPaused
      ? 0
      : (Date.now() - (lastActiveStartRef.current ?? Date.now())) / 1000;
    return {
      startedAt,
      activeAccumSec: activeAccumSecRef.current + additional,
      status: isPaused ? "paused" : "active",
      savedAt: new Date().toISOString(),
      date: formatLocalDate(),
    };
  }, [startedAt]);

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
    // 明示終了 → localStorage を破棄（次回はクリーンスタート）
    clearPersistedSession();
    console.log("[session-end]", { reason });
  }, []);

  // tick + idle 検知 (毎秒) + 永続化 (5 秒に 1 回)
  useEffect(() => {
    if (endedAt) return;
    let tickCount = 0;
    const interval = window.setInterval(() => {
      tickCount++;
      // elapsed を更新（active なら進行中の区間を含めて再計算）
      setElapsedSec(computeElapsed());
      // idle 検知: active かつ最終活動から idleTimeoutMs 経過 → auto-pause
      if (
        lastActiveStartRef.current !== null &&
        Date.now() - lastActivityRef.current > idleTimeoutMs
      ) {
        pause();
      }
      // 5 秒に 1 回、localStorage に save（writes を減らす）
      if (tickCount % 5 === 0) {
        savePersistedSession(buildSnapshot());
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [endedAt, idleTimeoutMs, pause, buildSnapshot]);

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

  // beforeunload: ブラウザ閉じる時に snapshot を保存（終了扱いにはしない）
  // ito19 さん指示: ブラウザ閉じ ≠ 学習終了。
  // 翌日以降は init lazy で別日判定 → 静かに破棄されるので、ここで触れない。
  useEffect(() => {
    const handler = () => {
      if (endedRef.current) return;
      // 明示終了してない → snapshot を保存（次回 mount で同日なら復元）
      savePersistedSession(buildSnapshot());
      // 警告ダイアログは出さない（事故閉じも自然に復帰できるので不要）
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [buildSnapshot]);

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
