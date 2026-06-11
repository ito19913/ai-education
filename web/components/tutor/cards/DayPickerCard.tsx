"use client";

/**
 * DayPickerCard - 「おかえり、今日なにやる?」儀式の候補ピッカー (Phase B、2026-06-11)。
 *
 * 上段 = 宿題・テスト (まだ、提出日近い順)、下段 = プラン外の本 (まとまり生成済み)。
 * 宿題タップ → 即 pick 追加 / 本タップ → まとまりピッカー (day-segment-picker) が続く。
 * 複数選択 OK なのでカードはロックせず、選んだ宿題だけ ✓ で無効化する (B-6)。
 * 断る動線 (「今日はプランだけでいい」) は quickReplies 側で出す。
 */
import { Card } from "@/components/ui/card";
import { Book, Check, ClipboardList, GraduationCap, Plus } from "lucide-react";
import type { TutorCard } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  card: Extract<TutorCard, { kind: "day-picker" }>;
  /**
   * 既に今日の枠に入っている対象のキー集合 (宿題 = materialId、
   * まとまり = `${materialId}:${segmentId}`)。重複選択を防ぐ (B-5)。
   */
  pickedKeys: Set<string>;
  onPickAssignment: (materialId: string, label: string) => void;
  onPickBook: (materialId: string, label: string) => void;
  /**
   * 「＋新しい宿題・テストを登録」→ その場で AssignmentDialog を開く
   * (帰ってきて今日の宿題をその場登録する一番多いケース。登録と同時に
   * 今日の枠へ自動 pick される)。
   */
  onAddAssignment: () => void;
};

export function DayPickerCard({
  card,
  pickedKeys,
  onPickAssignment,
  onPickBook,
  onAddAssignment,
}: Props) {
  return (
    <Card className="my-2 flex flex-col gap-3 p-3">
      {card.assignments.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            宿題・テスト (提出日が近い順)
          </p>
          <div className="flex flex-col gap-2">
            {card.assignments.map((a) => {
              const picked = pickedKeys.has(a.materialId);
              return (
                <button
                  key={a.materialId}
                  type="button"
                  disabled={picked}
                  onClick={() => onPickAssignment(a.materialId, a.label)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    picked
                      ? "cursor-default border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-border bg-card hover:border-primary hover:bg-primary/5",
                  )}
                >
                  {picked ? (
                    <Check className="size-4 shrink-0" strokeWidth={3} />
                  ) : a.isTest ? (
                    <GraduationCap className="size-4 shrink-0 text-violet-600" />
                  ) : (
                    <ClipboardList className="size-4 shrink-0 text-emerald-600" />
                  )}
                  <span className="inline-flex shrink-0 items-center justify-center rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground">
                    {a.subjectLabel}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {a.label}
                  </span>
                  {a.dueDate && (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {a.dueDate.slice(5).replace("-", "/")}まで
                    </span>
                  )}
                  {picked && (
                    <span className="shrink-0 text-[10px]">入れたよ</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {card.books.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            プランに入っていない本 (選ぶとまとまりを選べるよ)
          </p>
          <div className="flex flex-col gap-2">
            {card.books.map((b) => (
              <button
                key={b.materialId}
                type="button"
                onClick={() => onPickBook(b.materialId, b.label)}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Book className="size-4 shrink-0 text-primary" />
                <span className="inline-flex shrink-0 items-center justify-center rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground">
                  {b.subjectLabel}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {b.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {card.assignments.length === 0 && card.books.length === 0 && (
        <p className="text-sm text-muted-foreground">
          登録済みで選べるものは今日はないみたい。新しい宿題・テストは下から登録できるよ。
        </p>
      )}

      {/* 帰ってきて「今日の宿題」をその場登録する一番多いケース (登録と同時に今日へ) */}
      <button
        type="button"
        onClick={onAddAssignment}
        className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
        title="新しい宿題・テストを登録して、そのまま今日のタスクに入れます"
      >
        <Plus className="size-4" />
        <span className="font-medium">新しい宿題・テストを登録</span>
      </button>
    </Card>
  );
}
