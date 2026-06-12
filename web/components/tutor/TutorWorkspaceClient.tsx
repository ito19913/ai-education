"use client";

/**
 * TutorWorkspace の SSR 無効化ラッパー (2026-06-12)
 *
 * ゆい chat の初期メッセージは localStorage (今日の thread の復元) と現在時刻
 * (帰宅儀式の時間帯判定) に依存するため、サーバーが描画した挨拶 (「おはよう！」) と
 * クライアントの初回描画 (「おかえり！」等) が食い違い、hydration mismatch
 * (dev の右上「1 Issue」バッジ) が常時出ていた。
 *
 * 司令室はログイン後の完全クライアント駆動画面で SSR の利点が無いので、
 * `ssr: false` でクライアントのみ描画にして食い違いを根本から無くす。
 */

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

export const TutorWorkspaceClient = dynamic(
  () => import("./TutorWorkspace").then((m) => m.TutorWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh w-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    ),
  },
);
