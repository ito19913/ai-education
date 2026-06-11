"use client";

/**
 * SchedulePanel - ダッシュボード右カラムの「予定」カード (2026-06-09 拡張)。
 *
 * 「予定」を勉強専用から「何でも入る1本のカレンダー」に拡張 (grill 確定)。
 * - 勉強タスク (studyItems、当面モック) + 手動イベント (calendar.events、実DB) をマージ表示
 * - リスト / カレンダー トグル (デフォルト=リスト、セッション内ローカル state)
 * - 「＋予定を追加」(EventDialog) / 「ラベル」(LabelManagerDialog)
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarRange, Plus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CalendarEvent,
  EventLabel,
  EventLabelColor,
} from "@/lib/learn/types";
import type { CalendarEventInput } from "@/lib/schedule/calendar-events-repo";
import { mergeCalendarEntries } from "@/lib/schedule/merge";
import { ScheduleList } from "./ScheduleList";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { EventDialog } from "./EventDialog";
import { LabelManagerDialog } from "./LabelManagerDialog";

/** 予定パネルに必要なラベル/イベントのデータ + 操作。TutorWorkspace から渡す。 */
export type CalendarApi = {
  labels: EventLabel[];
  events: CalendarEvent[];
  onAddEvent: (input: CalendarEventInput) => void;
  onUpdateEvent: (id: string, patch: Partial<CalendarEventInput>) => void;
  onDeleteEvent: (id: string) => void;
  onAddLabel: (name: string, color: EventLabelColor) => void;
  onUpdateLabel: (
    id: string,
    patch: { name?: string; color?: EventLabelColor },
  ) => void;
  onDeleteLabel: (id: string) => void;
};

type Props = {
  calendar: CalendarApi;
  now?: Date;
};

export function SchedulePanel({ calendar, now }: Props) {
  const [mode, setMode] = useState<"list" | "calendar">("list");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);

  // 2026-06-10: 勉強モック (studyItems) のマージを撤去。手動イベントだけの正直な表示に。
  // (将来、宿題・テストの提出日マーカーをここに自動マージする = Phase 3)
  const entries = useMemo(
    () => mergeCalendarEntries([], calendar.events, calendar.labels),
    [calendar.events, calendar.labels],
  );

  // 新規予定の初期ラベル: 「遊び・予定」優先 → 任意の normal → 先頭
  const defaultLabelId = useMemo(
    () =>
      calendar.labels.find((l) => l.name === "遊び・予定")?.id ??
      calendar.labels.find((l) => l.kind === "normal")?.id ??
      calendar.labels[0]?.id,
    [calendar.labels],
  );

  const openAdd = () => {
    setEditingEvent(null);
    setEventDialogOpen(true);
  };
  const openEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setEventDialogOpen(true);
  };
  const handleSave = (input: CalendarEventInput, eventId?: string) => {
    if (eventId) calendar.onUpdateEvent(eventId, input);
    else calendar.onAddEvent(input);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 space-y-0 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarRange className="size-4 text-primary" />
            <span>予定</span>
          </CardTitle>
          <div className="inline-flex items-center rounded-md border border-border p-0.5">
            {(
              [
                { key: "list", label: "リスト" },
                { key: "calendar", label: "カレンダー" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setMode(opt.key)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  mode === opt.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={openAdd}
            className="h-7 flex-1 gap-1 text-xs"
          >
            <Plus className="size-3.5" />
            <span>予定を追加</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLabelDialogOpen(true)}
            className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="ラベルを管理"
          >
            <Tag className="size-3.5" />
            <span>ラベル</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {mode === "list" ? (
          <ScheduleList entries={entries} now={now} onEditEvent={openEdit} />
        ) : (
          <ScheduleCalendar entries={entries} now={now} />
        )}
      </CardContent>

      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        event={editingEvent}
        labels={calendar.labels}
        defaultLabelId={defaultLabelId}
        onSave={handleSave}
        onDelete={calendar.onDeleteEvent}
      />
      <LabelManagerDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        labels={calendar.labels}
        onAddLabel={calendar.onAddLabel}
        onUpdateLabel={calendar.onUpdateLabel}
        onDeleteLabel={calendar.onDeleteLabel}
      />
    </Card>
  );
}
