"use client";

/**
 * SidebarResizeHandle - shadcn Sidebar の右端でドラッグして幅を変える独自ハンドル。
 * Sidebar が collapsed（offcanvas）の時は非表示にする。
 * SidebarProvider が `--sidebar-width` CSS 変数を読む仕組みを利用。
 */
import { useSidebar } from "@/components/ui/sidebar";
import { useCallback } from "react";

type Props = {
  /** 幅変更コールバック（px） */
  onResize: (widthPx: number) => void;
  /** 最小幅 (px) */
  minWidth?: number;
  /** 最大幅 (px) */
  maxWidth?: number;
};

export function SidebarResizeHandle({
  onResize,
  minWidth = 180,
  maxWidth = 480,
}: Props) {
  const { state } = useSidebar();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const computed = getComputedStyle(document.documentElement)
        .getPropertyValue("--sidebar-width")
        .trim();
      // "16rem" 等は計算が難しいので、document.body の現在の sidebar 幅を実測
      const sidebarEl = document.querySelector<HTMLElement>(
        '[data-slot="sidebar-container"]',
      );
      const startWidth = sidebarEl
        ? sidebarEl.getBoundingClientRect().width
        : parseFloat(computed) || 256;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const next = Math.max(
          minWidth,
          Math.min(maxWidth, startWidth + delta),
        );
        onResize(next);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [onResize, minWidth, maxWidth],
  );

  // 折りたたみ（offcanvas）の時はハンドル不要
  if (state !== "expanded") return null;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="サイドバーの幅を変更"
      onMouseDown={handleMouseDown}
      className="absolute left-0 top-0 z-20 h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-border"
    />
  );
}
