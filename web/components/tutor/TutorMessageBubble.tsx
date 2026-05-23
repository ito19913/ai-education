"use client";

/**
 * TutorMessageBubble - 担任 chat の 1 メッセージ。
 * - role が tutor: 左寄せ、アバター付き、本文 + カード
 * - role が learner: 右寄せ、本文のみ
 * - role が section: 中央寄せの話題セクションヘッダー（Phase 3 拡張）
 */
import {
  BookOpenCheck,
  Coffee,
  GraduationCap,
  History,
  MessageCircle,
  Search,
  Sparkles,
  Sunrise,
  Target,
  Upload,
} from "lucide-react";
import type {
  Issue,
  KnowledgeNode,
  ScheduleItem,
  TutorMessage,
  TutorTopic,
} from "@/lib/learn/types";
import { TutorAvatar } from "./TutorAvatar";
import { SubjectPickerCard } from "./cards/SubjectPickerCard";
import { MaterialPickerCard } from "./cards/MaterialPickerCard";
import { RangePreviewCard } from "./cards/RangePreviewCard";
import { StartStudyCard } from "./cards/StartStudyCard";
import { IssueListCard } from "./cards/IssueListCard";
import { TodayScheduleCard } from "./cards/TodayScheduleCard";

type Props = {
  message: TutorMessage;
  nodes: KnowledgeNode[];
  onPickSubject: (subjectId: string, label: string) => void;
  onPickMaterial: (materialId: string, label: string) => void;
  /** Phase 3: 課題カードクリック → 右ペインに IssueChat */
  issues: Issue[];
  scheduleItems: ScheduleItem[];
  onSelectIssue: (issueId: string) => void;
  onSeeAllIssues: () => void;
  onSelectIssueItem: (issueId: string) => void;
  onSeeAllSchedule: () => void;
};

export function TutorMessageBubble({
  message,
  nodes,
  onPickSubject,
  onPickMaterial,
  issues,
  scheduleItems,
  onSelectIssue,
  onSeeAllIssues,
  onSelectIssueItem,
  onSeeAllSchedule,
}: Props) {
  // セクションヘッダー (話題区切り)
  if (message.role === "section") {
    return <TutorSectionHeader topic={message.topic} text={message.text} />;
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

/**
 * セクションヘッダー: 話題の区切り（朝の振り返り / 課題確認 / 学習開始 等）。
 * 中央寄せの細い区切り線 + アイコン + ラベル で表示。
 */
function TutorSectionHeader({
  topic,
  text,
}: {
  topic: TutorTopic | undefined;
  text: string | undefined;
}) {
  const t = topic ?? "free-chat";
  const label = text ?? topicLabel(t);
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border" />
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground">
        {renderTopicIcon(t)}
        <span>{label}</span>
      </div>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * 動的なコンポーネント参照（const Icon = ...; <Icon />）は React の
 * static-components ルールで NG なので、要素を直接返す関数で対応。
 */
function renderTopicIcon(topic: TutorTopic) {
  const cls = "size-3";
  switch (topic) {
    case "morning-reflection":
      return <Sunrise className={cls} />;
    case "excavation":
      return <Search className={cls} />;
    case "issue-check":
      return <Target className={cls} />;
    case "schedule-check":
      return <BookOpenCheck className={cls} />;
    case "history-check":
      return <History className={cls} />;
    case "material-add":
      return <Upload className={cls} />;
    case "subject-history":
      return <GraduationCap className={cls} />;
    case "start-study":
      return <Sparkles className={cls} />;
    case "ending":
      return <Coffee className={cls} />;
    case "free-chat":
      return <MessageCircle className={cls} />;
  }
}

function topicLabel(topic: TutorTopic): string {
  switch (topic) {
    case "morning-reflection":
      return "朝の振り返り";
    case "excavation":
      return "掘り起こし";
    case "issue-check":
      return "課題を確認";
    case "schedule-check":
      return "スケジュール確認";
    case "history-check":
      return "学習履歴を確認";
    case "material-add":
      return "教材を追加";
    case "subject-history":
      return "先生の対話履歴";
    case "start-study":
      return "学習を開始";
    case "ending":
      return "学習を終了";
    case "free-chat":
      return "おしゃべり";
  }
}
