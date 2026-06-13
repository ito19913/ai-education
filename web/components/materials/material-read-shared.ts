"use client";

/**
 * material-read-shared — 読書ビュー (MaterialReadPane) の共有ヘルパー・定数・
 * セッションキャッシュ (Phase 3 モノリス分割、2026-06-13: MaterialReadPane から移設、挙動同一)
 */

import type { ConceptSegment, GuidedBlock } from "@/lib/learn/types";

// まとまり全体を vision で渡す時の最大ページ数 (payload / 速度の上限、M8)。
// これを超える単元は均等サンプリングして代表ページだけ渡す。
export const MAX_SEGMENT_VISION_PAGES = 12;

// ガイド読書のブロックプラン生成で vision に渡すまとまりページの上限 (大きすぎるまとまり対策)。
export const GUIDED_MAX_PAGES = 16;

// 宿題「AI と解く」: 問題ブロック検出で vision に渡すページ上限 (宿題は数ページが普通)。
export const ASSIGNMENT_MAX_PAGES = 12;

/**
 * 「学習内容でない区切り」(表紙・前付け・目次・使い方・奥付・索引など) かを名前で判定。
 * 区切り生成プロンプト (segment-claude) でも出さないようにしているが、古いデータや
 * 取りこぼし対策として、学習開始時はこれをスキップして最初の本物の単元へ進む。
 */
export function isFrontMatterName(name: string): boolean {
  return /表紙|扉|前付|まえがき|はじめに|序文|目次|もくじ|使い方|凡例|奥付|索引|さくいん|著者|広告|後付|あとがき/.test(
    name,
  );
}

/**
 * 区切り (ConceptSegment[]) のセッション内キャッシュ (materialId → segments)。
 * migration 未適用で DB 保存できない / 既存教材で未生成 の時、開くたびに葵が
 * その場で区切り直す (M4 のオンデマンド版)。同セッションでは 1 回だけ走る。
 */
export const sessionSegmentCache = new Map<string, ConceptSegment[]>();

/**
 * オンデマンド区切りを「一度試した」教材 ID (成否問わず)。
 * スキャン本など区切りが 0 件で終わる教材を、再レンダのたびに延々と再生成し続ける
 * 無限ループを防ぐ (= 1 教材 1 回だけ試す)。成功時は sessionSegmentCache に入る。
 */
export const attemptedSegmentation = new Set<string>();

/**
 * ガイド読書のブロックプラン (GuidedBlock[]) のセッション内キャッシュ (segment.id → blocks)。
 * 同じまとまりを開き直しても葵の vision 解析を 1 回で済ませる (G-A)。
 */
export const sessionGuidedPlanCache = new Map<string, GuidedBlock[]>();

/** 範囲 [start,end] のページを最大 max 枚に均等サンプリングして返す。 */
export function sampleRangePages(pages: number[], max: number): number[] {
  if (pages.length <= max) return pages;
  const out: number[] = [];
  const stepF = (pages.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(pages[Math.round(i * stepF)]);
  return [...new Set(out)];
}

/** "p.24-37" / "p.24-" などから開始ページ番号を取り出す。取れなければ null。 */
export function parseStartPage(pageRange?: string): number | null {
  if (!pageRange) return null;
  const m = pageRange.match(/p\.?\s*(\d+)/i);
  return m ? Number.parseInt(m[1], 10) : null;
}
