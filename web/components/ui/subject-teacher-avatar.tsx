"use client";

/**
 * SubjectTeacherAvatar - 科目の先生 5 人のシンプル SVG アバター。
 *
 * 2026-05-25 grill 2 (科目追加設計) 由来。MOCK_SUBJECTS の 5 教科ハードコードに対応する
 * 5 人分の SVG アバターを定義し、共通コンポーネント `<SubjectTeacherAvatar />` で呼び出す。
 *
 * シンプルな円顔 + 髪 + 目 + 口 構成。クオリティは「アイコン風」止まり、写実的ではない。
 * 各先生の科目色を背景に使い、性別・性格イメージを髪型と表情の差で表現。
 *
 * 手動追加された科目 (id が AVATAR_MAP にない) は fallbackLetter (Subject.teacher.avatarLetter)
 * + 中性色背景で表示。
 */
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

const DEFAULT_SIZE = 40;

type AvatarProps = {
  size?: number;
  className?: string;
};

/** 葵先生 (英語) — セミロング、女性、明るい笑顔、sky 系 */
function AoiAvatar({ size = DEFAULT_SIZE, className }: AvatarProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label="あおい先生">
      <circle cx="50" cy="50" r="48" fill="#e0f2fe" />
      {/* 髪 (セミロング、両サイドに垂れる) */}
      <path d="M 18 50 Q 50 5 82 50 L 82 82 Q 72 78 65 80 L 35 80 Q 28 78 18 82 Z" fill="#4c1d95" />
      {/* 顔 */}
      <ellipse cx="50" cy="58" rx="24" ry="26" fill="#fde7c7" />
      {/* 髪の前髪 */}
      <path d="M 28 40 Q 50 30 72 40 L 70 50 Q 50 42 30 50 Z" fill="#4c1d95" />
      {/* 目 */}
      <ellipse cx="40" cy="58" rx="3" ry="3.5" fill="#1f2937" />
      <ellipse cx="60" cy="58" rx="3" ry="3.5" fill="#1f2937" />
      {/* 口 (明るい笑顔) */}
      <path d="M 42 72 Q 50 78 58 72" fill="none" stroke="#1f2937" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** かずや先生 (数学) — ショート、男性、メガネ、emerald 系 */
function KazuyaAvatar({ size = DEFAULT_SIZE, className }: AvatarProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label="かずや先生">
      <circle cx="50" cy="50" r="48" fill="#d1fae5" />
      {/* 髪 (ショート、サイドはすっきり) */}
      <path d="M 25 45 Q 50 18 75 45 L 75 55 Q 65 48 50 48 Q 35 48 25 55 Z" fill="#1f2937" />
      {/* 顔 */}
      <ellipse cx="50" cy="58" rx="24" ry="26" fill="#fde7c7" />
      {/* メガネ (2 つの円 + 鼻ブリッジ) */}
      <circle cx="40" cy="58" r="7" fill="none" stroke="#1f2937" strokeWidth="1.5" />
      <circle cx="60" cy="58" r="7" fill="none" stroke="#1f2937" strokeWidth="1.5" />
      <line x1="47" y1="58" x2="53" y2="58" stroke="#1f2937" strokeWidth="1.5" />
      {/* 目 */}
      <circle cx="40" cy="58" r="2.5" fill="#1f2937" />
      <circle cx="60" cy="58" r="2.5" fill="#1f2937" />
      {/* 口 (落ち着いた直線笑) */}
      <path d="M 43 73 L 57 73" fill="none" stroke="#1f2937" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** みやび先生 (国語) — ロング、女性、上品、rose 系 */
function MiyabiAvatar({ size = DEFAULT_SIZE, className }: AvatarProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label="みやび先生">
      <circle cx="50" cy="50" r="48" fill="#ffe4e6" />
      {/* 髪 (ロング、肩より下まで) */}
      <path d="M 15 50 Q 50 3 85 50 L 88 92 Q 75 88 65 90 L 35 90 Q 25 88 12 92 Z" fill="#3f1d2c" />
      {/* 顔 */}
      <ellipse cx="50" cy="58" rx="22" ry="26" fill="#fde7c7" />
      {/* 前髪 (中央分け) */}
      <path d="M 28 42 Q 40 36 50 42 Q 60 36 72 42 L 70 50 Q 60 44 50 46 Q 40 44 30 50 Z" fill="#3f1d2c" />
      {/* 目 (おだやか) */}
      <path d="M 36 58 Q 40 56 44 58" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      <path d="M 56 58 Q 60 56 64 58" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      {/* 口 (上品な微笑) */}
      <path d="M 44 73 Q 50 76 56 73" fill="none" stroke="#be185d" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** さとし先生 (理科) — ショート、男性、好奇心 (上向き眉)、violet 系 */
function SatoshiAvatar({ size = DEFAULT_SIZE, className }: AvatarProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label="さとし先生">
      <circle cx="50" cy="50" r="48" fill="#ede9fe" />
      {/* 髪 (くせ毛ショート) */}
      <path d="M 22 48 Q 30 22 50 20 Q 70 22 78 48 L 75 55 Q 65 45 50 50 Q 35 45 25 55 Z" fill="#3b2a4a" />
      <circle cx="32" cy="32" r="6" fill="#3b2a4a" />
      <circle cx="68" cy="32" r="6" fill="#3b2a4a" />
      {/* 顔 */}
      <ellipse cx="50" cy="60" rx="23" ry="25" fill="#fde7c7" />
      {/* 眉 (上向き、好奇心) */}
      <path d="M 35 52 Q 40 48 45 52" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      <path d="M 55 52 Q 60 48 65 52" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      {/* 目 (キラキラ表現、白い点) */}
      <circle cx="40" cy="60" r="3.5" fill="#1f2937" />
      <circle cx="60" cy="60" r="3.5" fill="#1f2937" />
      <circle cx="41" cy="59" r="1.2" fill="#ffffff" />
      <circle cx="61" cy="59" r="1.2" fill="#ffffff" />
      {/* 口 (にっこり) */}
      <path d="M 42 73 Q 50 78 58 73" fill="none" stroke="#1f2937" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** ゆうき先生 (社会) — ミディアム、中性、笑顔、amber 系 */
function YukiAvatar({ size = DEFAULT_SIZE, className }: AvatarProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label="ゆうき先生">
      <circle cx="50" cy="50" r="48" fill="#fef3c7" />
      {/* 髪 (ミディアム、ふんわり) */}
      <path d="M 20 50 Q 50 10 80 50 L 78 70 Q 68 65 60 68 L 40 68 Q 32 65 22 70 Z" fill="#78350f" />
      {/* 顔 */}
      <ellipse cx="50" cy="58" rx="24" ry="25" fill="#fde7c7" />
      {/* 前髪 (横分け) */}
      <path d="M 28 38 Q 50 32 72 40 L 70 48 Q 55 42 35 50 Z" fill="#78350f" />
      {/* 目 (細め、ニコッ) */}
      <path d="M 35 60 Q 40 64 45 60" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      <path d="M 55 60 Q 60 64 65 60" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      {/* 口 (にこっとオープン) */}
      <path d="M 40 72 Q 50 80 60 72" fill="#fff" stroke="#1f2937" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const AVATAR_MAP: Record<string, (props: AvatarProps) => ReactNode> = {
  "subj-english": AoiAvatar,
  "subj-math": KazuyaAvatar,
  "subj-japanese": MiyabiAvatar,
  "subj-science": SatoshiAvatar,
  "subj-social": YukiAvatar,
};

type Props = {
  /** Subject.id。AVATAR_MAP に無い id (手動追加された科目) は fallback */
  subjectId: string;
  size?: number;
  className?: string;
  /** fallback 表示用の 1 文字 (通常 Subject.teacher.avatarLetter) */
  fallbackLetter?: string;
};

export function SubjectTeacherAvatar({ subjectId, size, className, fallbackLetter }: Props) {
  const Component = AVATAR_MAP[subjectId];
  if (Component) {
    return <Component size={size} className={cn("rounded-full", className)} />;
  }
  // fallback: 1 文字 + 中性色背景 (手動追加された科目用)
  const px = size ?? DEFAULT_SIZE;
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground",
        className,
      )}
      style={{ width: px, height: px, fontSize: px * 0.4 }}
      aria-label={fallbackLetter ? `${fallbackLetter} 先生のアバター` : "先生のアバター"}
    >
      {fallbackLetter ?? "?"}
    </div>
  );
}
