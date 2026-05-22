"use client";

/**
 * TutorMessageBubble - 担任 chat の 1 メッセージ。
 * - role が tutor: 左寄せ、アバター付き、本文 + カード
 * - role が learner: 右寄せ、本文のみ
 */
import type { KnowledgeNode, TutorMessage } from "@/lib/learn/types";
import { TutorAvatar } from "./TutorAvatar";
import { SubjectPickerCard } from "./cards/SubjectPickerCard";
import { MaterialPickerCard } from "./cards/MaterialPickerCard";
import { RangePreviewCard } from "./cards/RangePreviewCard";
import { StartStudyCard } from "./cards/StartStudyCard";

type Props = {
  message: TutorMessage;
  nodes: KnowledgeNode[];
  onPickSubject: (subjectId: string, label: string) => void;
  onPickMaterial: (materialId: string, label: string) => void;
};

export function TutorMessageBubble({
  message,
  nodes,
  onPickSubject,
  onPickMaterial,
}: Props) {
  if (message.role === "tutor") {
    return (
      <div className="flex items-start gap-2.5">
        <TutorAvatar size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">
            ゆい先生
          </span>
          {message.text && (
            <div className="rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-card-foreground whitespace-pre-wrap">
              {message.text}
            </div>
          )}
          {message.card && (
            <div className="max-w-[600px]">
              {message.card.kind === "subject-picker" && (
                <SubjectPickerCard
                  card={message.card}
                  onPick={onPickSubject}
                />
              )}
              {message.card.kind === "material-picker" && (
                <MaterialPickerCard
                  card={message.card}
                  onPick={onPickMaterial}
                />
              )}
              {message.card.kind === "range-preview" && (
                <RangePreviewCard card={message.card} nodes={nodes} />
              )}
              {message.card.kind === "start-study" && (
                <StartStudyCard card={message.card} />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // learner
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground whitespace-pre-wrap">
        {message.text}
      </div>
    </div>
  );
}
