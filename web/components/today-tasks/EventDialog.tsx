"use client";

/**
 * EventDialog - 手動の予定 (CalendarEvent) の追加 / 編集 / 削除 (2026-06-09)。
 *
 * 項目 (grill 確定): タイトル(必須) / 日付(必須) / ラベル(既定=遊び・予定) /
 * 時間(任意・終日OK) / メモ(任意)。編集時は削除ボタンも出す。
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorClasses } from "@/lib/learn/event-colors";
import type { CalendarEvent, EventLabel } from "@/lib/learn/types";
import type { CalendarEventInput } from "@/lib/schedule/calendar-events-repo";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = 新規追加 / 値あり = 編集 */
  event: CalendarEvent | null;
  labels: EventLabel[];
  /** 新規時の初期ラベル (遊び・予定 など)。無ければ先頭ラベル */
  defaultLabelId?: string;
  /** 新規追加時に渡される初期日付 (YYYY-MM-DD)。無ければ今日 */
  initialDate?: string;
  onSave: (input: CalendarEventInput, eventId?: string) => void;
  onDelete: (id: string) => void;
};

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  labels,
  defaultLabelId,
  initialDate,
  onSave,
  onDelete,
}: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey());
  const [labelId, setLabelId] = useState("");
  const [time, setTime] = useState("");
  const [memo, setMemo] = useState("");

  // 開いた時に対象 (編集) or 既定 (新規) で初期化
  useEffect(() => {
    if (!open) return;
    const fallbackLabel = defaultLabelId ?? labels[0]?.id ?? "";
    /* eslint-disable react-hooks/set-state-in-effect */
    if (event) {
      setTitle(event.title);
      setDate(event.date);
      setLabelId(event.labelId || fallbackLabel);
      setTime(event.time ?? "");
      setMemo(event.memo ?? "");
    } else {
      setTitle("");
      setDate(initialDate ?? todayKey());
      setLabelId(fallbackLabel);
      setTime("");
      setMemo("");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, event, defaultLabelId, initialDate, labels]);

  const canSave = title.trim().length > 0 && date.length > 0 && labelId.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave(
      {
        title: title.trim(),
        date,
        labelId,
        time: time || undefined,
        memo: memo.trim() || undefined,
      },
      event?.id,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? "予定を編集" : "予定を追加"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ev-title">タイトル</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: サッカーの試合 / 英検"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-date">日付</Label>
              <Input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-time">時間（任意）</Label>
              <Input
                id="ev-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>ラベル</Label>
            <Select
              value={labelId}
              onValueChange={(v) => setLabelId(v ?? "")}
            >
              <SelectTrigger>
                {/* base-ui の SelectValue は値(id)をそのまま出すので、関数で名前+色に変換 */}
                <SelectValue placeholder="ラベルを選ぶ">
                  {(value) => {
                    const l = labels.find((x) => x.id === value);
                    if (!l) return "ラベルを選ぶ";
                    return (
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2.5 rounded-full",
                            colorClasses(l.color).dot,
                          )}
                        />
                        {l.name}
                      </span>
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {labels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-full",
                          colorClasses(l.color).dot,
                        )}
                      />
                      {l.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ev-memo">メモ（任意）</Label>
            <Textarea
              id="ev-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="持ち物・場所など"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          {event ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onDelete(event.id);
                onOpenChange(false);
              }}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              <span>削除</span>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave}>
              {event ? "保存" : "追加"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
