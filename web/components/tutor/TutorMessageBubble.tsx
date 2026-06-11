"use client";

/**
 * TutorMessageBubble - 担任 chat の 1 メッセージ。
 * - role が tutor: 左寄せ、アバター付き、本文 + カード
 * - role が learner: 右寄せ、本文のみ
 * - role が section: 中央寄せの話題セクションヘッダー（Phase 3 拡張）
 */
import type {
  Issue,
  KnowledgeNode,
  ScheduleItem,
  TutorMessage,
  TutorTopic,
} from "@/lib/learn/types";
import { MarkdownText } from "@/components/chat/MarkdownText";
import { TutorAvatar } from "./TutorAvatar";
import { SubjectPickerCard } from "./cards/SubjectPickerCard";
import { MaterialPickerCard } from "./cards/MaterialPickerCard";
import { RangePreviewCard } from "./cards/RangePreviewCard";
import { StartStudyCard } from "./cards/StartStudyCard";
import { IssueListCard } from "./cards/IssueListCard";
import { TodayScheduleCard } from "./cards/TodayScheduleCard";
import { ChatSearchResultCard } from "./cards/ChatSearchResultCard";
import { DurationPickerCard } from "./cards/DurationPickerCard";
import { RoadmapPreviewCard } from "./cards/RoadmapPreviewCard";
import { WeakNodePickerCard } from "./cards/WeakNodePickerCard";
import { NodeReviewSuggestionCard } from "./cards/NodeReviewSuggestionCard";
import { ReplanDraftCard } from "./cards/ReplanDraftCard";
import { DayPickerCard } from "./cards/DayPickerCard";
import { DaySegmentPickerCard } from "./cards/DaySegmentPickerCard";
import { TopicChip } from "./topic-display";

type Props = {
  message: TutorMessage;
  nodes: KnowledgeNode[];
  onPickSubject: (subjectId: string, label: string) => void;
  onPickMaterial: (materialId: string, label: string) => void;
  /** C8 Phase 4: 計画立案フローの期間 + 回転数選択 */
  onPickDuration: (monthsPerRotation: number, rotations: number) => void;
  /** C17 Phase 5 P5-Q2: 計画立案フローの弱いノード選択 */
  onPickWeakNodes: (selectedNodeIds: string[]) => void;
  /** Phase 3: 課題カードクリック → 右ペインに IssueChat */
  issues: Issue[];
  scheduleItems: ScheduleItem[];
  onSelectIssue: (issueId: string) => void;
  onSeeAllIssues: () => void;
  onSelectIssueItem: (issueId: string) => void;
  onSeeAllSchedule: () => void;
  /** Phase B (2026-06-11): 「今日なにやる?」儀式のピッカー操作 */
  dayPickedKeys: Set<string>;
  onPickDayAssignment: (materialId: string, label: string) => void;
  onPickDayBook: (materialId: string, label: string) => void;
  onPickDaySegment: (
    materialId: string,
    segmentId: string,
    label: string,
  ) => void;
};

export function TutorMessageBubble({
  message,
  nodes,
  onPickSubject,
  onPickMaterial,
  onPickDuration,
  onPickWeakNodes,
  issues,
  scheduleItems,
  onSelectIssue,
  onSeeAllIssues,
  onSelectIssueItem,
  onSeeAllSchedule,
  dayPickedKeys,
  onPickDayAssignment,
  onPickDayBook,
  onPickDaySegment,
}: Props) {
  // セクションヘッダー (話題区切り)
  if (message.role === "section") {
    return <TutorSectionHeader topic={message.topic} />;
  }

  if (message.role === "tutor") {
    return (
      <div className="flex items-start gap-2.5">
        <TutorAvatar size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">
            ゆい先生
          </span>
          {message.text && (
            <div className="rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5 text-card-foreground">
              <MarkdownText text={message.text} variant="card" />
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
              {message.card.kind === "issue-list" && (
                <IssueListCard
                  card={message.card}
                  issues={issues}
                  nodes={nodes}
                  onSelectIssue={onSelectIssue}
                  onSeeAll={onSeeAllIssues}
                />
              )}
              {message.card.kind === "today-schedule" && (
                <TodayScheduleCard
                  card={message.card}
                  items={scheduleItems}
                  onSelectIssueItem={onSelectIssueItem}
                  onSeeAll={onSeeAllSchedule}
                />
              )}
              {message.card.kind === "chat-search-result" && (
                <ChatSearchResultCard card={message.card} />
              )}
              {message.card.kind === "duration-picker" && (
                <DurationPickerCard
                  card={message.card}
                  onPick={onPickDuration}
                />
              )}
              {message.card.kind === "roadmap-preview" && (
                <RoadmapPreviewCard card={message.card} />
              )}
              {message.card.kind === "weak-node-picker" && (
                <WeakNodePickerCard
                  card={message.card}
                  onPick={onPickWeakNodes}
                />
              )}
              {message.card.kind === "node-review-suggestion" && (
                <NodeReviewSuggestionCard card={message.card} />
              )}
              {message.card.kind === "replan-draft" && (
                <ReplanDraftCard card={message.card} />
              )}
              {message.card.kind === "day-picker" && (
                <DayPickerCard
                  card={message.card}
                  pickedKeys={dayPickedKeys}
                  onPickAssignment={onPickDayAssignment}
                  onPickBook={onPickDayBook}
                />
              )}
              {message.card.kind === "day-segment-picker" && (
                <DaySegmentPickerCard
                  card={message.card}
                  pickedKeys={dayPickedKeys}
                  onPickSegment={onPickDaySegment}
                />
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
      <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-primary-foreground">
        <MarkdownText text={message.text ?? ""} variant="bubble-primary" />
      </div>
    </div>
  );
}

/**
 * セクションヘッダー: 話題の区切り（朝の振り返り / 課題確認 / 学習開始 等）。
 * 中央寄せの細い区切り線 + アイコン + ラベル で表示。
 */
function TutorSectionHeader({
  topic,
}: {
  topic: TutorTopic | undefined;
}) {
  const t = topic ?? "free-chat";
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border" />
      <TopicChip topic={t} />
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
