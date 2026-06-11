"use client";

/**
 * PlanAddDialog - 「プランに組み込む」ミニダイアログ (2026-06-10、grill 確定)。
 *
 * ザックリ方針: 期間 (チェックポイント日) を選ぶだけ。対話なし、10 秒で成立。
 * - クイック選択 (1ヶ月 / 3ヶ月 / 6ヶ月) + カスタム日付
 * - AI の参考ペース表示 (まとまり数 ÷ 週数。煽らない、事実だけ)
 * - まとまり未生成の教材は組み込めない (呼び出し側でボタンを出さない前提だが、ここでも防御)
 */
import { useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { getPlanSegments } from "@/lib/plans/plan-progress";
import type { Material } from "@/lib/learn/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
  /** 組み込む (endsAt = YYYY-MM-DD) */
  onCreate: (endsAt: string) => void;
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return ymd(d);
}

const QUICK_CHOICES = [
  { months: 1, label: "1ヶ月" },
  { months: 3, label: "3ヶ月" },
  { months: 6, label: "6ヶ月" },
] as const;

export function PlanAddDialog({ open, onOpenChange, material, onCreate }: Props) {
  const [endsAt, setEndsAt] = useState(addMonths(3));
  const [pickedMonths, setPickedMonths] = useState<number | null>(3);
  // 「今」の基準 (参考ペース計算用)。render 中の Date.now() を避け、開いた時に確定する。
  const [refNow, setRefNow] = useState(0);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setEndsAt(addMonths(3));
    setPickedMonths(3);
    setRefNow(Date.now());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  const segments = useMemo(
    () => (material ? getPlanSegments(material) : []),
    [material],
  );

  // 参考ペース (事実だけ。「〜しないと間に合わない」とは言わない)
  const paceNote = useMemo(() => {
    if (segments.length === 0 || !endsAt || refNow === 0) return null;
    const days = Math.max(
      1,
      Math.round((new Date(endsAt).getTime() - refNow) / (1000 * 60 * 60 * 24)),
    );
    const weeks = Math.max(1, Math.round(days / 7));
    const perWeek = Math.ceil(segments.length / weeks);
    return `全 ${segments.length} まとまり。この期間だと週に ${perWeek} まとまりくらいのペースが目安だよ（終わらなくても大丈夫）`;
  }, [segments, endsAt, refNow]);

  const canCreate = !!material && segments.length > 0 && endsAt.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>プランに組み込む</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <p className="text-sm text-muted-foreground">
            「{material?.name ?? ""}」のまとまりが上から順に、今日のタスクに 1
            つずつ出てくるようになるよ。
          </p>

          <div className="flex flex-col gap-1.5">
            <Label>期間（チェックポイント）</Label>
            <div className="flex items-center gap-1.5">
              {QUICK_CHOICES.map((c) => (
                <button
                  key={c.months}
                  type="button"
                  onClick={() => {
                    setPickedMonths(c.months);
                    setEndsAt(addMonths(c.months));
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    pickedMonths === c.months
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/60",
                  )}
                >
                  {c.label}
                </button>
              ))}
              <Input
                type="date"
                value={endsAt}
                onChange={(e) => {
                  setEndsAt(e.target.value);
                  setPickedMonths(null);
                }}
                className="h-8 w-auto text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              期間が来たら「延長する・ここで終了・最初からやり直す」を選べるよ。予定表じゃないから、終わらなくても OK。
            </p>
          </div>

          {paceNote && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">
              {paceNote}
            </div>
          )}

          {material && segments.length === 0 && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              この教材はまだ「まとまり」が作られていないので組み込めないよ。先に「一緒に読む」で一度開いてね。
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            size="sm"
            disabled={!canCreate}
            onClick={() => {
              onCreate(endsAt);
              onOpenChange(false);
            }}
          >
            組み込む
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
