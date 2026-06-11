"use client";

/**
 * LabelManagerDialog - 予定ラベルの管理 (改名 / 色変更 / 追加 / 削除、2026-06-09)。
 *
 * grill 確定: 色は固定パレットから選ぶ。kind="study" (勉強) は削除保護。
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EVENT_LABEL_PALETTE,
  colorClasses,
} from "@/lib/learn/event-colors";
import type { EventLabel, EventLabelColor } from "@/lib/learn/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: EventLabel[];
  onAddLabel: (name: string, color: EventLabelColor) => void;
  onUpdateLabel: (
    id: string,
    patch: { name?: string; color?: EventLabelColor },
  ) => void;
  onDeleteLabel: (id: string) => void;
};

function PalettePicker({
  value,
  onChange,
}: {
  value: EventLabelColor;
  onChange: (c: EventLabelColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {EVENT_LABEL_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={cn(
            "size-5 rounded-full ring-offset-1 transition",
            colorClasses(c).swatch,
            value === c
              ? "ring-2 ring-foreground"
              : "ring-0 hover:ring-2 hover:ring-border",
          )}
        />
      ))}
    </div>
  );
}

function LabelRow({
  label,
  onUpdateLabel,
  onDeleteLabel,
}: {
  label: EventLabel;
  onUpdateLabel: Props["onUpdateLabel"];
  onDeleteLabel: Props["onDeleteLabel"];
}) {
  const [name, setName] = useState(label.name);
  const protectedLabel = label.kind === "study";

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== label.name) {
      onUpdateLabel(label.id, { name: trimmed });
    } else if (!trimmed) {
      setName(label.name);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn("size-3 shrink-0 rounded-full", colorClasses(label.color).dot)}
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-7 flex-1 text-sm"
        />
        {label.kind === "exam" && (
          <span className="shrink-0 rounded bg-violet-500/15 px-1.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
            試験
          </span>
        )}
        {protectedLabel ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            勉強用
          </span>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (
                window.confirm(
                  `ラベル「${label.name}」を削除しますか？（この予定の色は灰色に戻ります）`,
                )
              ) {
                onDeleteLabel(label.id);
              }
            }}
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
            title="削除"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
      <PalettePicker
        value={label.color}
        onChange={(c) => onUpdateLabel(label.id, { color: c })}
      />
    </div>
  );
}

export function LabelManagerDialog({
  open,
  onOpenChange,
  labels,
  onAddLabel,
  onUpdateLabel,
  onDeleteLabel,
}: Props) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<EventLabelColor>("teal");

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddLabel(trimmed, newColor);
    setNewName("");
    setNewColor("teal");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ラベルを管理</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto py-1">
          {labels.map((l) => (
            <LabelRow
              key={l.id}
              label={l}
              onUpdateLabel={onUpdateLabel}
              onDeleteLabel={onDeleteLabel}
            />
          ))}
        </div>

        {/* 新規追加 */}
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-muted/20 p-2.5">
          <div className="text-[11px] font-medium text-muted-foreground">
            新しいラベルを追加
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="ラベル名（例: 部活）"
              className="h-7 flex-1 text-sm"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="h-7 shrink-0 gap-1 px-2"
            >
              <Plus className="size-3.5" />
              <span>追加</span>
            </Button>
          </div>
          <PalettePicker value={newColor} onChange={setNewColor} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
