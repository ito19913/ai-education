"use client";

/**
 * RightPaneRouter - /tutor 右ペインの内容を ?view= に応じて切り替える（Phase 3）。
 *
 * - default: 空のプレースホルダ
 * - issues: IssueListView コア（embedded=true）
 * - issue: IssueChat
 * - today-tasks: TodayTaskDashboard コア（embedded=true、C22 で schedule からリネーム）
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
  NoteEntry,
  RightPaneView,
  ScheduleItem,
  Subject,
} from "@/lib/learn/types";
import { IssueListView } from "@/components/issues/IssueListView";
import { IssueChat } from "@/components/issues/IssueChat";
import { TodayTaskDashboard } from "@/components/today-tasks/TodayTaskDashboard";
import { HistoryView } from "@/components/history/HistoryView";
import { MaterialEditWizard } from "@/components/admin/MaterialEditWizard";
import { MaterialDetailView } from "@/components/materials/MaterialDetailView";
import { MaterialsListPane } from "@/components/materials/MaterialsListPane";
import { SubjectHistoryView } from "@/components/subjects/SubjectHistoryView";
import {
  SubjectSettingsPanel,
  type NewSubjectInput,
} from "@/components/subjects/SubjectSettingsPanel";
import { TutorArchiveView } from "@/components/tutor/TutorArchiveView";
import { ReflectionListView } from "@/components/reflections/ReflectionListView";
import { WeeklyMonthlyReportView } from "@/components/reports/WeeklyMonthlyReportView";
import { PlanEngineDashboard } from "@/components/plans/PlanEngineDashboard";
import { NotesHomeView } from "@/components/notes/NotesHomeView";
// MOCK_MATERIALS は TutorWorkspace 経由で props として渡される (C46: 編集・削除のため state 管理)
import type { Material } from "@/lib/learn/types";

type Props = {
  view: RightPaneView;
  selectedIssue: Issue | null;
  /** URL ?subjectId= で指定された subject ID（subject-history 用）*/
  selectedSubjectId: string | null;
  /** URL ?id= で指定された material ID（material-detail 用、C32 2026-05-25 grill 1）*/
  selectedMaterialId: string | null;
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
  onMaterialAdded: (material: Material, approvedNodeCount: number) => void;
  /**
   * 教材編集 (C46 F、ito19 さん意見): メタ情報 patch を materials state に反映
   * (MaterialEditDialog の onSave)
   */
  onMaterialUpdated: (id: string, patch: Partial<Material>) => void;
  /**
   * 教材削除 (C46 F、ito19 さん意見): in-memory 削除 + ゆい発話 + 一覧に戻す
   * (MaterialEditDialog の onDelete)
   */
  onMaterialDeleted: (id: string) => void;
  /**
   * 科目追加完了時のコールバック（subjects view 用、C30 2026-05-25 grill 2 S6）。
   * TutorWorkspace 側で MOCK_SUBJECTS / subjects state に push + ゆいの完了発話 + 右ペイン閉じる。
   */
  onSubjectAdded: (input: NewSubjectInput) => void;
  /**
   * 全教材リスト (state ベース、C46 F)。MaterialsListPane / MaterialDetailView で参照
   */
  materials: Material[];
  /** まとめノート N9①: ノートエントリ一覧 (NotesHomeView 用) */
  noteEntries: NoteEntry[];
  /** ノート自分メモ / ステータス更新 */
  onNoteUpdated: (
    id: string,
    patch: { userNote?: string; status?: "understood" | "open" },
  ) => void;
  /** ノートエントリ削除 (論理削除) */
  onNoteDeleted: (id: string) => void;
  /** ノートの出典「読む」→ 読書ビューの該当ページへ */
  onOpenNoteSource: (materialId: string, page: number) => void;
};

export function RightPaneRouter({
  view,
  selectedIssue,
  selectedSubjectId,
  selectedMaterialId,
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
  onMaterialUpdated,
  onMaterialDeleted,
  onSubjectAdded,
  materials,
  noteEntries,
  onNoteUpdated,
  onNoteDeleted,
  onOpenNoteSource,
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

  if (view === "today-tasks") {
    return (
      <TodayTaskDashboard
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

  if (view === "reflections") {
    // ReflectionListView は MOCK_REFLECTION_LOGS / MOCK_ISSUES / MOCK_HANDOFFS
    // を直接 import する (Phase 7 で Supabase 化する時にここを props 化する)
    return <ReflectionListView nodes={nodes} subjects={subjects} />;
  }

  if (view === "weekly-report") {
    return (
      <WeeklyMonthlyReportView mode="weekly" nodes={nodes} subjects={subjects} />
    );
  }

  if (view === "monthly-report") {
    return (
      <WeeklyMonthlyReportView mode="monthly" nodes={nodes} subjects={subjects} />
    );
  }

  if (view === "plans") {
    // C21 Phase 5 P5-Q6: Plan Engine ダッシュボード
    return <PlanEngineDashboard nodes={nodes} />;
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

  if (view === "materials") {
    // C44 2026-05-26 (ito19 さん意見、残課題⑤ 解消): 教材一覧ペイン
    // ゆいメニュー「教材」ボタン → 「教材一覧」発話 → tutor-mock 分岐 → 本ペイン
    // C46: materials を props 経由 (state 管理) に変更、編集・削除が即座に反映される
    return <MaterialsListPane materials={materials} subjects={subjects} />;
  }

  if (view === "subjects") {
    // C30 2026-05-25 grill 2 S6: 科目設定パネル
    return <SubjectSettingsPanel subjects={subjects} onSubjectAdded={onSubjectAdded} />;
  }

  if (view === "material-detail") {
    // C32 2026-05-25 grill 1 確定 5/11/12: 教材詳細ページ
    // C46 F: materials を props 経由 (state) で受ける + 編集・削除 callback 渡し
    const material = selectedMaterialId
      ? materials.find((m) => m.id === selectedMaterialId)
      : undefined;
    if (!material) {
      return (
        <NotFoundPane
          message="教材が見つかりませんでした"
          onBack={onBack}
        />
      );
    }
    const subject = subjects.find((s) => s.id === material.subjectId) ?? null;
    return (
      <MaterialDetailView
        material={material}
        subject={subject}
        nodes={nodes}
        onMaterialUpdated={onMaterialUpdated}
        onMaterialDeleted={onMaterialDeleted}
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

  if (view === "notes") {
    return (
      <NotesHomeView
        entries={noteEntries}
        materials={materials}
        onOpenSource={onOpenNoteSource}
        onUpdateEntry={onNoteUpdated}
        onDeleteEntry={onNoteDeleted}
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
