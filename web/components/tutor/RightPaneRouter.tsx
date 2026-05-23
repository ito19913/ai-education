"use client";

/**
 * RightPaneRouter - /tutor 右ペインの内容を ?view= に応じて切り替える（Phase 3）。
 *
 * - default: 空のプレースホルダ
 * - issues: IssueListView コア（embedded=true）
 * - issue: IssueChat
 * - schedule: ScheduleDashboard コア（embedded=true）
 * - history: HistoryView コア（embedded=true）
 */
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ChatMessage,
  ExamPrep,
  Homework,
  Issue,
  IssueChatMessage,
  KnowledgeNode,
  LearningSession,
  LessonReview,
  RightPaneView,
  ScheduleItem,
  Subject,
} from "@/lib/learn/types";
import { IssueListView } from "@/components/issues/IssueListView";
import { IssueChat } from "@/components/issues/IssueChat";
import { ScheduleDashboard } from "@/components/schedule/ScheduleDashboard";
import { HistoryView } from "@/components/history/HistoryView";
import { MaterialEditWizard } from "@/components/admin/MaterialEditWizard";
import { SubjectHistoryView } from "@/components/subjects/SubjectHistoryView";
import { TutorArchiveView } from "@/components/tutor/TutorArchiveView";

type Props = {
  view: RightPaneView;
  selectedIssue: Issue | null;
  /** URL ?subjectId= で指定された subject ID（subject-history 用）*/
  selectedSubjectId: string | null;
  issues: Issue[];
  nodes: KnowledgeNode[];
  chatMessages: ChatMessage[];
  scheduleToday: ScheduleItem[];
  scheduleUpcoming: ScheduleItem[];
  exams: ExamPrep[];
  homeworks: Homework[];
  lessonReviews: LessonReview[];
  subjects: Subject[];
  sessions: LearningSession[];
  onResolveIssue: (id: string) => void;
  onReopenIssue: (id: string) => void;
  onAppendChatMessages: (issueId: string, msgs: IssueChatMessage[]) => void;
  onSelectIssue: (id: string) => void;
  onSelectIssueItem: (id: string) => void;
  onBack: () => void;
  /**
   * 教材追加完了時のコールバック（material-new view 用）。
   * TutorWorkspace 側でゆいの完了発話を追加 + 右ペインを閉じる。
   */
  onMaterialAdded: (materialName: string, approvedNodeCount: number) => void;
};

export function RightPaneRouter({
  view,
  selectedIssue,
  selectedSubjectId,
  issues,
  nodes,
  chatMessages,
  scheduleToday,
  scheduleUpcoming,
  exams,
  homeworks,
  lessonReviews,
  subjects,
  sessions,
  onResolveIssue,
  onReopenIssue,
  onAppendChatMessages,
  onSelectIssue,
  onSelectIssueItem,
  onBack,
  onMaterialAdded,
}: Props) {
  if (view === "default") {
    return <DefaultPane />;
  }

  if (view === "issues") {
    return (
      <IssueListView
        issues={issues}
        nodes={nodes}
        onResolve={onResolveIssue}
        onReopen={onReopenIssue}
        embedded
        onSelectIssue={onSelectIssue}
      />
    );
  }

  if (view === "issue") {
    if (!selectedIssue) {
      return (
        <NotFoundPane
          message="その課題は見つかりませんでした（もう resolved 済みかも）"
          onBack={onBack}
        />
      );
    }
    return (
      <IssueChat
        issue={selectedIssue}
        nodes={nodes}
        chatMessages={chatMessages}
        onResolve={() => onResolveIssue(selectedIssue.id)}
        onReopen={() => onReopenIssue(selectedIssue.id)}
        onAppendMessages={(msgs) =>
          onAppendChatMessages(selectedIssue.id, msgs)
        }
        onBack={onBack}
      />
    );
  }

  if (view === "schedule") {
    return (
      <ScheduleDashboard
        subjects={subjects}
        initialTodayItems={scheduleToday}
        upcomingItems={scheduleUpcoming}
        exams={exams}
        homeworks={homeworks}
        lessonReviews={lessonReviews}
        issues={issues}
        embedded
        onSelectIssueItem={onSelectIssueItem}
      />
    );
  }

  if (view === "history") {
    return (
      <HistoryView
        sessions={sessions}
        nodes={nodes}
        subjects={subjects}
        embedded
      />
    );
  }

  if (view === "material-new") {
    return (
      <MaterialEditWizard
        subjects={subjects}
        existingNodes={nodes}
        embedded
        onComplete={onMaterialAdded}
      />
    );
  }

  if (view === "tutor-archive") {
    return (
      <TutorArchiveView
        nodes={nodes}
        issues={issues}
        scheduleItems={scheduleToday}
      />
    );
  }

  if (view === "subject-history") {
    if (!selectedSubjectId) {
      return (
        <NotFoundPane
          message="科目が指定されていません"
          onBack={onBack}
        />
      );
    }
    return (
      <SubjectHistoryView
        subjectId={selectedSubjectId}
        subjects={subjects}
        nodes={nodes}
        chatMessages={chatMessages}
        issues={issues}
      />
    );
  }

  return <DefaultPane />;
}

function DefaultPane() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-canvas p-6">
      <Card className="max-w-md border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <MessageCircle className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            ゆい先生と話してみよう
          </p>
          <p className="text-xs text-muted-foreground">
            「課題見せて」「スケジュール見せて」と言うと、ここに展開するよ。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NotFoundPane({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-canvas p-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
            <ArrowLeft className="size-3.5" />
            <span>もどる</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
