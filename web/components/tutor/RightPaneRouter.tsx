"use client";

/**
 * RightPaneRouter - /tutor 右ペインの内容を ?view= に応じて切り替える（Phase 3）。
 *
 * - default: ダッシュボード (2026-06-09)
 * - issues: IssueListView コア（embedded=true）
 * - issue: IssueChat
 * - history: LearningHistoryView
 * - materials / material-detail / material-new: 教材まわり
 * - plans / notes / subjects / ...: 各ドメインペイン
 *
 * Props 整理 (Phase 3 モノリス分割、2026-06-13): 62 個の flat props を
 * 既存の calendar: CalendarApi と同じ「ドメインごとの束」に集約。
 * 中身のハンドラ・データは移設前と同一 (名前だけ束内で短縮)。
 */
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NewAssignmentInput } from "@/lib/materials/materials-repo";
import type {
  AssignmentStatus,
  ChatMessage,
  DailyPick,
  Issue,
  IssueChatMessage,
  KnowledgeNode,
  LearningLog,
  Material,
  NoteEntry,
  StudyMinutesBucket,
  Resume,
  RightPaneView,
  ScheduleItem,
  StudyPlan,
  Subject,
} from "@/lib/learn/types";
import { IssueListView } from "@/components/issues/IssueListView";
import { IssueChat } from "@/components/issues/IssueChat";
import {
  DashboardPane,
} from "@/components/today-tasks/DashboardPane";
import type { CalendarApi } from "@/components/today-tasks/SchedulePanel";
import { LearningHistoryView } from "@/components/history/LearningHistoryView";
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
import { PlansView } from "@/components/plans/PlansView";
import { NotesHomeView } from "@/components/notes/NotesHomeView";

/** 課題 (Issue) 束: 一覧 + 課題 chat。 */
export type IssuesPaneApi = {
  issues: Issue[];
  /** URL ?id= で選択中の課題（issue view 用）*/
  selectedIssue: Issue | null;
  chatMessages: ChatMessage[];
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onAppendChatMessages: (issueId: string, msgs: IssueChatMessage[]) => void;
  onSelect: (id: string) => void;
};

/** 教材 (本) 束: 一覧 / 詳細 / 登録ウィザード。 */
export type MaterialsPaneApi = {
  /** 全教材リスト (state ベース、C46 F) */
  materials: Material[];
  /**
   * 教材データの表示状態 (2026-06-12 レビュー指摘: fetch 失敗を空と区別する)。
   * loading = 初期取得中 / error = 取得失敗 / ready = 取得済み (空なら本当に 0 件)。
   */
  loadState: "loading" | "error" | "ready";
  /** 教材追加完了 (material-new view)。ゆい発話 + 詳細遷移は TutorWorkspace 側 */
  onAdded: (material: Material, approvedNodeCount: number) => void;
  /** 教材編集 (C46 F): メタ情報 patch を materials state に反映 */
  onUpdated: (id: string, patch: Partial<Material>) => void;
  /** 教材削除 (C46 F): 削除 + ゆい発話 + 一覧に戻す */
  onDeleted: (id: string) => void;
  /** 「区切り直す」(2026-06-13): まとまり生成ジョブを再キュー (全状態可、古い単元は残す) */
  onResegment: (id: string) => void;
};

/** 宿題・テスト束 (2026-06-09、教材ペイン + ダッシュボード用)。 */
export type AssignmentsPaneApi = {
  /** 追加 or 編集 (id があれば編集)。PDF があれば一緒にアップ/差し替え */
  onSubmit: (input: NewAssignmentInput, pdfFile?: File, id?: string) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: AssignmentStatus) => void;
  /** 「AI と解く」→ 読書ビューで PDF を開いて葵と解く */
  onStudy: (materialId: string) => void;
  /** ダッシュボード宿題カードの「＋追加」→ その場登録ダイアログ (Phase B 拡張) */
  onAddQuick: () => void;
};

/** 新プラン束 (ザックリ・まとまりキュー型、2026-06-10)。 */
export type PlansPaneApi = {
  plans: StudyPlan[];
  onCreate: (material: Material, endsAt: string, countFrom?: string) => void;
  onExtend: (planId: string, endsAt: string) => void;
  onComplete: (planId: string) => void;
  onRestart: (plan: StudyPlan, endsAt: string) => void;
  onToggleSkip: (planId: string, segmentId: string) => void;
  onDelete: (planId: string) => void;
};

/** レジュメ束: ピース (note_entries) + 冊 (resumes、R10) + アウトライン (R11)。 */
export type ResumesPaneApi = {
  noteEntries: NoteEntry[];
  resumes: Resume[];
  /** ピースの自分メモ / ステータス更新 */
  onNoteUpdated: (
    id: string,
    patch: { userNote?: string; status?: "understood" | "open" },
  ) => void;
  /** ピース削除 (論理削除) */
  onNoteDeleted: (id: string) => void;
  /** 出典「読む」→ 読書ビューの該当ページへ */
  onOpenSource: (materialId: string, page: number) => void;
  /** R10 Phase 2: 冊を追加 (同科目)。作成した Resume を返す (新冊への移動/選択用) */
  onAddResume: (subjectId: string, name: string) => Promise<Resume | null>;
  /** R10 Phase 2: 冊名のリネーム */
  onRenameResume: (id: string, name: string) => void;
  /** R10 Phase 2: デフォルト冊を変更 */
  onSetDefaultResume: (id: string, subjectId: string) => void;
  /** R10 Phase 2: 冊を削除 (中身はデフォルト冊へ) */
  onDeleteResume: (id: string, subjectId: string) => void;
  /** R10 Phase 2: ピースを別冊へ振り分け (同一科目内) */
  onMoveEntryToResume: (entryId: string, resumeId: string) => void;
  /** R10: 科目付け間違いの修正 (別科目のデフォルト冊へ移す) */
  onMoveEntryToSubject: (entryId: string, subjectId: string) => void;
  /** R10 Phase 3: 冊をコピー (同科目に中身ごと複製) */
  onCopyResume: (
    sourceResumeId: string,
    sourceSubjectId: string,
    newName: string,
  ) => void;
  /** R11-①: 冊のアウトラインを AI 下書き / 言葉で修正 (instruction 任意) */
  onGenerateOutline: (resume: Resume, instruction?: string) => Promise<void>;
};

/** 「きょう決めたこと」束 (Phase B、2026-06-11、ダッシュボード下段用)。 */
export type DayPicksPaneApi = {
  dayPicks: DailyPick[];
  /** pick を外す (「やめとく」) */
  onRemove: (id: string) => void;
  /** 「＋ゆいと決める」→ 左の chat に儀式カードを出す */
  onStartRitual: () => void;
};

type Props = {
  view: RightPaneView;
  /** URL ?subjectId= で指定された subject ID（subject-history / notes 用）*/
  selectedSubjectId: string | null;
  /** URL ?id= で指定された material ID（material-detail 用、C32 2026-05-25 grill 1）*/
  selectedMaterialId: string | null;
  nodes: KnowledgeNode[];
  scheduleToday: ScheduleItem[];
  subjects: Subject[];
  /** 学習履歴 (出来事ログ + 学習時間、2026-06-10。旧 sessions モックを置換) */
  learningLogs: LearningLog[];
  studyMinutes: StudyMinutesBucket[];
  onBack: () => void;
  /**
   * 科目追加完了時のコールバック（subjects view 用、C30 2026-05-25 grill 2 S6）。
   * TutorWorkspace 側で subjects state に push + ゆいの完了発話 + 右ペイン閉じる。
   */
  onSubjectAdded: (input: NewSubjectInput) => void;
  /** ダッシュボードの各カード/セクション → 該当ビューへ (2026-06-09)。navigate を渡す */
  onNavigate: (
    view: RightPaneView,
    params?: {
      issueId?: string;
      materialId?: string;
      tab?: string;
      page?: number;
      unit?: boolean;
    },
  ) => void;
  /** ダッシュボードの予定パネル (ラベル + 手動イベント + 操作、2026-06-09) */
  calendar: CalendarApi;
  issuesApi: IssuesPaneApi;
  materialsApi: MaterialsPaneApi;
  assignmentsApi: AssignmentsPaneApi;
  plansApi: PlansPaneApi;
  resumesApi: ResumesPaneApi;
  dayApi: DayPicksPaneApi;
};

export function RightPaneRouter({
  view,
  selectedSubjectId,
  selectedMaterialId,
  nodes,
  scheduleToday,
  subjects,
  learningLogs,
  studyMinutes,
  onBack,
  onSubjectAdded,
  onNavigate,
  calendar,
  issuesApi,
  materialsApi,
  assignmentsApi,
  plansApi,
  resumesApi,
  dayApi,
}: Props) {
  // 2026-06-09: トップ (default) と 旧「今日のタスク」(today-tasks、ボタン廃止後も
  // 既存リンク互換のため alias) はダッシュボードを表示する。
  if (view === "default" || view === "today-tasks") {
    return (
      <DashboardPane
        calendar={calendar}
        issues={issuesApi.issues}
        nodes={nodes}
        materials={materialsApi.materials}
        materialsLoadState={materialsApi.loadState}
        subjects={subjects}
        noteEntries={resumesApi.noteEntries}
        plans={plansApi.plans}
        dayPicks={dayApi.dayPicks}
        onRemoveDayPick={dayApi.onRemove}
        onStartDayRitual={dayApi.onStartRitual}
        onAddAssignmentQuick={assignmentsApi.onAddQuick}
        onToggleAssignmentStatus={assignmentsApi.onToggleStatus}
        onNavigate={onNavigate}
      />
    );
  }

  if (view === "issues") {
    return (
      <IssueListView
        issues={issuesApi.issues}
        nodes={nodes}
        onResolve={issuesApi.onResolve}
        onReopen={issuesApi.onReopen}
        embedded
        onSelectIssue={issuesApi.onSelect}
      />
    );
  }

  if (view === "issue") {
    const selectedIssue = issuesApi.selectedIssue;
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
        chatMessages={issuesApi.chatMessages}
        onResolve={() => issuesApi.onResolve(selectedIssue.id)}
        onReopen={() => issuesApi.onReopen(selectedIssue.id)}
        onAppendMessages={(msgs) =>
          issuesApi.onAppendChatMessages(selectedIssue.id, msgs)
        }
        onBack={onBack}
      />
    );
  }

  if (view === "history") {
    // 2026-06-10: 学習履歴 (出来事ログ + 学習時間、自動・実データ)。
    // 旧セッション型 HistoryView (モック) を置換。
    return (
      <LearningHistoryView
        logs={learningLogs}
        studyMinutes={studyMinutes}
        subjects={subjects}
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
    // 2026-06-10: 新プラン (ザックリ・まとまりキュー型)。旧 PlanEngineDashboard を置換。
    return (
      <PlansView
        plans={plansApi.plans}
        materials={materialsApi.materials}
        subjects={subjects}
        noteEntries={resumesApi.noteEntries}
        onStudy={(materialId, page) =>
          onNavigate("material-read", { materialId, page, unit: true })
        }
        onExtend={plansApi.onExtend}
        onComplete={plansApi.onComplete}
        onRestart={plansApi.onRestart}
        onToggleSkip={plansApi.onToggleSkip}
        onDelete={plansApi.onDelete}
        onOpenMaterials={() => onNavigate("materials")}
      />
    );
  }

  if (view === "material-new") {
    return (
      <MaterialEditWizard
        subjects={subjects}
        existingNodes={nodes}
        embedded
        onComplete={materialsApi.onAdded}
      />
    );
  }

  if (view === "materials") {
    // C44 2026-05-26 (ito19 さん意見、残課題⑤ 解消): 教材一覧ペイン
    // ゆいメニュー「教材」ボタン → 「教材一覧」発話 → tutor-mock 分岐 → 本ペイン
    // C46: materials を props 経由 (state 管理) に変更、編集・削除が即座に反映される
    return (
      <MaterialsListPane
        materials={materialsApi.materials}
        materialsLoadState={materialsApi.loadState}
        subjects={subjects}
        onSubmitAssignment={assignmentsApi.onSubmit}
        onDeleteAssignment={assignmentsApi.onDelete}
        onToggleAssignmentStatus={assignmentsApi.onToggleStatus}
        onStudyAssignment={assignmentsApi.onStudy}
      />
    );
  }

  if (view === "subjects") {
    // C30 2026-05-25 grill 2 S6: 科目設定パネル
    return <SubjectSettingsPanel subjects={subjects} onSubjectAdded={onSubjectAdded} />;
  }

  if (view === "material-detail") {
    // C32 2026-05-25 grill 1 確定 5/11/12: 教材詳細ページ
    // C46 F: materials を props 経由 (state) で受ける + 編集・削除 callback 渡し
    const material = selectedMaterialId
      ? materialsApi.materials.find((m) => m.id === selectedMaterialId)
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
        issues={issuesApi.issues}
        plans={plansApi.plans}
        noteEntries={resumesApi.noteEntries}
        onCreatePlan={plansApi.onCreate}
        onMaterialUpdated={materialsApi.onUpdated}
        onMaterialDeleted={materialsApi.onDeleted}
        onResegment={materialsApi.onResegment}
      />
    );
  }

  if (view === "tutor-archive") {
    return (
      <TutorArchiveView
        nodes={nodes}
        issues={issuesApi.issues}
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
        chatMessages={issuesApi.chatMessages}
        issues={issuesApi.issues}
      />
    );
  }

  if (view === "notes") {
    return (
      <NotesHomeView
        entries={resumesApi.noteEntries}
        materials={materialsApi.materials}
        subjects={subjects}
        resumes={resumesApi.resumes}
        initialSubjectId={selectedSubjectId ?? undefined}
        onOpenSource={resumesApi.onOpenSource}
        onUpdateEntry={resumesApi.onNoteUpdated}
        onDeleteEntry={resumesApi.onNoteDeleted}
        onAddResume={resumesApi.onAddResume}
        onRenameResume={resumesApi.onRenameResume}
        onSetDefaultResume={resumesApi.onSetDefaultResume}
        onDeleteResume={resumesApi.onDeleteResume}
        onMoveEntryToResume={resumesApi.onMoveEntryToResume}
        onMoveEntryToSubject={resumesApi.onMoveEntryToSubject}
        onCopyResume={resumesApi.onCopyResume}
        onGenerateOutline={resumesApi.onGenerateOutline}
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
