"use client";

/**
 * EditableHighlight — ガイド読書の青枠ハイライト (手動調整つき)。
 * (Phase 3 モノリス分割、2026-06-13: MaterialReadPane から移設、挙動同一)
 *
 * 枠本体をドラッグで移動、四隅のハンドルで拡大・縮小。座標は親 (ページ div) に対する
 * 正規化 (0-1)。AI 推定 bbox がズレた時、子がその場で直接ドラッグして直せる (ito19 要望)。
 */

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type Bbox = { x: number; y: number; w: number; h: number };

export function EditableHighlight({
  bbox,
  onChange,
  onCommit,
  onDragStart,
}: {
  bbox: Bbox;
  onChange: (b: Bbox) => void;
  /**
   * ドラッグ終了 (指を離した) 時に 1 回。指を離した画面座標を渡す (見開きで反対ページへ
   * またいだ時に、ドロップ先ページ/ブロックを親が特定するため)。DB 永続化もここ。
   */
  onCommit?: (dropClientX: number, dropClientY: number) => void;
  /** ドラッグ開始時に元 bbox を通知 (別ブロックへ動かした時の選択し直し判定用)。 */
  onDragStart?: (original: Bbox) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: string;
    px: number;
    py: number;
    start: Bbox;
    rw: number;
    rh: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  // 押した対象の data-handle 属性で「移動 (move)」か「四隅リサイズ (nw/ne/sw/se)」かを判定。
  // ※ ハンドラはレンダーごとに生成せず直接割り当てる (factory-in-render を避け、ref 警告を回避)。
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const box = ref.current;
    const parent = box?.parentElement;
    if (!box || !parent) return;
    const mode = (e.target as HTMLElement).dataset.handle ?? "move";
    const rect = parent.getBoundingClientRect();
    drag.current = {
      mode,
      px: e.clientX,
      py: e.clientY,
      start: { ...bbox },
      rw: rect.width || 1,
      rh: rect.height || 1,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    onDragStart?.({ ...bbox });
    box.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    const dx = (e.clientX - d.px) / d.rw;
    const dy = (e.clientY - d.py) / d.rh;
    let { x, y, w, h } = d.start;
    if (d.mode === "move") {
      x += dx;
      y += dy;
    } else {
      if (d.mode.includes("e")) w += dx;
      if (d.mode.includes("s")) h += dy;
      if (d.mode.includes("w")) {
        x += dx;
        w -= dx;
      }
      if (d.mode.includes("n")) {
        y += dy;
        h -= dy;
      }
    }
    w = Math.max(0.04, Math.min(1, w));
    h = Math.max(0.04, Math.min(1, h));
    x = Math.max(0, Math.min(1 - w, x));
    y = Math.max(0, Math.min(1 - h, y));
    onChange({ x, y, w, h });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    ref.current?.releasePointerCapture?.(e.pointerId);
    // pointercancel 等で座標が無い場合は最後に拾った move 座標を使う。
    const dropX = Number.isFinite(e.clientX) ? e.clientX : d.lastX;
    const dropY = Number.isFinite(e.clientY) ? e.clientY : d.lastY;
    onCommit?.(dropX, dropY);
  };

  const handlePos: Record<string, string> = {
    nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      title="枠をドラッグで移動 / 角をつまんでサイズ変更"
      className="absolute cursor-move touch-none rounded-sm border-2 border-sky-500/80 bg-sky-300/20 shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
      style={{
        left: `${bbox.x * 100}%`,
        top: `${bbox.y * 100}%`,
        width: `${bbox.w * 100}%`,
        height: `${bbox.h * 100}%`,
      }}
    >
      {(["nw", "ne", "sw", "se"] as const).map((c) => (
        <div
          key={c}
          data-handle={c}
          className={`absolute size-3 rounded-full border border-white bg-sky-600 shadow ${handlePos[c]}`}
        />
      ))}
    </div>
  );
}
