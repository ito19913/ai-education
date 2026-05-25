"use client";

/**
 * SubjectPickerCard - 担任 chat 内で「何の教科にする?」を選ぶカード。
 *
 * 2026-05-25 grill 2 (科目追加設計) C28: Folder アイコン → SubjectTeacherAvatar (SVG) に置換、
 * 5 教科ハードコード対応。手動追加された科目は fallback (avatarLetter) で表示。
 */
import { Card } from "@/components/ui/card";
import { SubjectTeacherAvatar } from "@/components/ui/subject-teacher-avatar";
import { Check } from "lucide-react";
import type { TutorCard } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  card: Extract<TutorCard, { kind: "subject-picker" }>;
  /** クリックされた瞬間に呼ばれる。selectedSubjectId がある時は disabled */
  onPick: (subjectId: string, label: string) => void;
};

export function SubjectPickerCard({ card, onPick }: Props) {
  const locked = !!card.selectedSubjectId;
  return (
    <Card className="my-2 p-3">
      <p className="mb-2 text-[11px] text-muted-foreground">教科を選んでね</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {card.options.map((opt) => {
          const picked = card.selectedSubjectId === opt.subjectId;
          return (
            <button
              key={opt.subjectId}
              type="button"
              disabled={locked}
              onClick={() => onPick(opt.subjectId, opt.label)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                picked
                  ? "border-primary bg-primary/10 text-primary"
                  : locked
                    ? "cursor-default border-border bg-muted/40 text-muted-foreground opacity-60"
                    : "border-border bg-card hover:border-primary hover:bg-primary/5",
              )}
            >
              {picked ? (
                <Check className="size-7 shrink-0" strokeWidth={3} />
              ) : (
                <SubjectTeacherAvatar subjectId={opt.subjectId} size={28} className="shrink-0" />
              )}
              <span className="font-medium">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
