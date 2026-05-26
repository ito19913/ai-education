"use client";

/**
 * TutorWorkspace - /tutor の 2 ペイン司令室（Phase 3）。
 *
 * 構造:
 *   - 左ペイン: TutorChat（ゆい先生との会話）
 *   - 右ペイン: RightPaneRouter（?view= に応じて IssueListView / IssueChat / TodayTaskDashboard / HistoryView を切替）
 *
 * 状態:
 *   - URL ?view=...&id=... を権威として保持
 *   - ゆい chat の rightPaneAction → router.push で URL を変える
 *   - 既存の issues / today schedule の state（resolve / chatThread 追加）も一元管理
 *
 * 入力欄の振る舞い（ARCHITECTURE §「入力欄の振る舞い」）:
 *   - 右ペインが view=issue（課題 chat）の時のみ、左ゆい入力欄が disabled
 *   - 「もどる」で右ペインを閉じると、フォーカスは左ゆいに戻る
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpenCheck, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorChat } from "./TutorChat";
import { RightPaneRouter } from "./RightPaneRouter";
import {
  buildInitialTutorThread,
  buildNextTutorReply,
  EVENING_RITUAL_LAST_DATE_KEY,
  emptySchoolReportDraft,
  shouldStartEveningRitual,
  type TutorStep,
} from "@/lib/learn/tutor-mock";
import { formatLocalDate } from "@/lib/learn/session-storage";
import {
  loadTutorThread,
  saveTutorThread,
} from "@/lib/learn/tutor-thread-storage";
import { MOCK_MATERIALS, MOCK_SUBJECTS } from "@/lib/learn/mock-data";
import type {
  ChatMessage,
  ExamPrep,
  Homework,
  Issue,
  IssueChatMessage,
  KnowledgeNode,
  LearningSession,
  LessonReview,
  Material,
  RightPaneView,
  ScheduleItem,
  Subject,
  TutorMessage,
  TutorRightPaneAction,
} from "@/lib/learn/types";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

type Props = {
  nodes: KnowledgeNode[];
  initialIssues: Issue[];
  initialScheduleToday: ScheduleItem[];
  scheduleUpcoming: ScheduleItem[];
  exams: ExamPrep[];
  homeworks: Homework[];
  lessonReviews: LessonReview[];
  subjects: Subject[];
  sessions: LearningSession[];
  chatMessages: ChatMessage[];
};

function viewFromParam(raw: string | null): RightPaneView {
  if (
    raw === "issues" ||
    raw === "issue" ||
    raw === "today-tasks" ||
    raw === "history" ||
    raw === "reflections" ||
    raw === "weekly-report" ||
    raw === "monthly-report" ||
    raw === "plans" ||
    raw === "material-new" ||
    raw === "material-detail" || // C32 2026-05-25 grill 1 確定 5/11/12 (C40 で許可リスト追加忘れ fix)
    raw === "materials" || // C44 2026-05-26: 教材一覧 (ito19 さん意見、残課題⑤ 解消)
    raw === "subjects" || // C30 2026-05-25 grill 2 S6
    raw === "subject-history" ||
    raw === "tutor-archive"
  ) {
    return raw;
  }
  return "default";
}

export function TutorWorkspace({
  nodes,
  initialIssues,
  initialScheduleToday,
  scheduleUpcoming,
  exams,
  homeworks,
  lessonReviews,
  subjects: initialSubjects,
  sessions,
  chatMessages,
}: Props) {
  // C30 2026-05-25 grill 2 S7: 科目追加対応で subjects を useState 化
  // SubjectSettingsPanel から動的 push される
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  // C46 2026-05-26 F (ito19 さん意見): 教材編集・削除のため materials を state 管理
  // 現状は in-memory mutation (Phase 7 で Supabase 化、関連 LearningPlan / SI / GT
  // との整合も Phase 7 grill)。RightPaneRouter 経由で MaterialsListPane / MaterialDetailView に
  // 最新 state を流す
  const [materials, setMaterials] = useState<Material[]>(MOCK_MATERIALS);
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = viewFromParam(searchParams.get("view"));
  const selectedIssueId = searchParams.get("id");
  const selectedSubjectId = searchParams.get("subjectId");
  // C32 2026-05-25 grill 1: material-detail view では id クエリを materialId として解釈
  const selectedMaterialId =
    searchParams.get("view") === "material-detail" ? searchParams.get("id") : null;
  // /tutor?ending=1: /learn の「学習を終了」から来た時、ゆいを ending モードで起動
  const endingMode = searchParams.get("ending") === "1";

  // ----- ゆい chat の state（1 日 1 thread、localStorage 永続化）-----
  //
  // 設計（ito19 さん指示 2026-05-24）:
  //   - 1 日 1 chat。同日内に戻ったら継続（朝の振り返り → 課題 → ... → 終了 を 1 本に蓄積）
  //   - 別日は破棄せず archive 残し、今日は新規 thread
  //   - ending mode（/tutor?ending=1）の場合: 既存 thread に終了挨拶を append
  //
  // 初期メッセージ: lazy init で localStorage チェック + mode 分岐を 1 回
  const [tutorInit] = useState(() => {
    const today = formatLocalDate();
    const stored = loadTutorThread(today);
    const existingMessages = stored?.messages ?? [];

    if (endingMode) {
      // ending: 既存 thread に終了の挨拶を append（無ければ新規 thread + ending greeting）
      const endingGreeting = buildInitialTutorThread(
        new Date(),
        "ending",
      ).messages;
      return {
        messages: [...existingMessages, ...endingGreeting],
        state: "ending-vent" as const,
        endingVentItems: [] as string[],
      };
    }

    if (existingMessages.length > 0) {
      // 同日継続: 復元
      return {
        messages: existingMessages,
        state: (stored?.state ?? "reflection-yesterday") as TutorStep["state"],
        endingVentItems: stored?.endingVentItems ?? [],
      };
    }

    // C10: 平日 16:00 以降 + 今日帰宅儀式やってない → 帰宅儀式モードで起動
    let lastEveningRitualDate: string | null = null;
    if (typeof window !== "undefined") {
      lastEveningRitualDate = window.localStorage.getItem(
        EVENING_RITUAL_LAST_DATE_KEY,
      );
    }
    if (shouldStartEveningRitual(new Date(), lastEveningRitualDate)) {
      const eveningMessages = buildInitialTutorThread(
        new Date(),
        "evening",
      ).messages;
      return {
        messages: eveningMessages,
        state: "evening-await-period-count" as TutorStep["state"],
        endingVentItems: [] as string[],
      };
    }

    // 今日初めて: 朝の挨拶で新規 thread
    return {
      messages: buildInitialTutorThread(new Date(), "morning").messages,
      state: "reflection-yesterday" as const,
      endingVentItems: [] as string[],
    };
  });

  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>(
    tutorInit.messages,
  );
  const tutorStepRef = useRef<TutorStep>({
    state: tutorInit.state,
    endingVentItems: tutorInit.endingVentItems,
    // C10: 帰宅儀式モードで起動した場合は draft も初期化
    schoolReportDraft:
      tutorInit.state === "evening-await-period-count"
        ? emptySchoolReportDraft()
        : undefined,
  });

  // メッセージ or 状態が変化したら localStorage に保存（5 秒に 1 回程度で十分だが
  // メッセージ追加はそんなに頻繁じゃないので毎回 save で OK）。
  useEffect(() => {
    if (tutorMessages.length === 0) return;
    saveTutorThread({
      date: formatLocalDate(),
      messages: tutorMessages,
      state: tutorStepRef.current.state,
      endingVentItems: tutorStepRef.current.endingVentItems,
      savedAt: new Date().toISOString(),
    });

    // C10: 帰宅儀式 (evening-finalize) 到達時に localStorage に今日の日付を保存
    // → 同日内の再起動で帰宅儀式が二重発火しない
    if (
      tutorStepRef.current.state === "evening-finalize" &&
      typeof window !== "undefined"
    ) {
      window.localStorage.setItem(
        EVENING_RITUAL_LAST_DATE_KEY,
        formatLocalDate(),
      );
    }
  }, [tutorMessages]);

  // ----- Issue state（resolve / chatThread 追加を一元管理） -----
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  // Today schedule（done トグル等は TodayTaskDashboard 内で完結するが、
  // /tutor 右ペインでも同じ初期データを使う）
  const [scheduleToday] = useState<ScheduleItem[]>(initialScheduleToday);

  const selectedIssue = useMemo(
    () => issues.find((i) => i.id === selectedIssueId) ?? null,
    [issues, selectedIssueId],
  );

  // ----- URL 操作 -----
  const navigate = useCallback(
    (
      next: RightPaneView,
      params?: { issueId?: string; subjectId?: string; materialId?: string },
    ) => {
      const url = new URLSearchParams();
      if (next !== "default") url.set("view", next);
      if (next === "issue" && params?.issueId) url.set("id", params.issueId);
      if (next === "material-detail" && params?.materialId)
        url.set("id", params.materialId);
      if (next === "subject-history" && params?.subjectId)
        url.set("subjectId", params.subjectId);
      const q = url.toString();
      router.push(q ? `/tutor?${q}` : "/tutor");
    },
    [router],
  );

  const applyRightPaneAction = useCallback(
    (action: TutorRightPaneAction) => {
      switch (action.kind) {
        case "open-issues":
          navigate("issues");
          break;
        case "open-issue":
          navigate("issue", { issueId: action.issueId });
          break;
        case "open-today-tasks":
          navigate("today-tasks");
          break;
        case "open-history":
          navigate("history");
          break;
        case "open-reflections":
          navigate("reflections");
          break;
        case "open-weekly-report":
          navigate("weekly-report");
          break;
        case "open-monthly-report":
          navigate("monthly-report");
          break;
        case "open-plans":
          navigate("plans");
          break;
        case "open-material-new":
          navigate("material-new");
          break;
        case "open-material-detail":
          navigate("material-detail", { materialId: action.materialId });
          break;
        case "open-materials":
          navigate("materials");
          break;
        case "open-subjects":
          navigate("subjects");
          break;
        case "open-subject-history":
          navigate("subject-history", { subjectId: action.subjectId });
          break;
        case "open-tutor-archive":
          navigate("tutor-archive");
          break;
        case "close":
          navigate("default");
          break;
      }
    },
    [navigate],
  );

  // ----- 教材編集 (C46 F、ito19 さん意見): メタ情報 patch を materials state に反映 -----
  const handleMaterialUpdated = useCallback(
    (id: string, patch: Partial<Material>) => {
      setMaterials((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
    },
    [],
  );

  // ----- 教材削除 (C46 F、ito19 さん意見): in-memory 削除 + ゆい発話 + 一覧に戻す -----
  const handleMaterialDeleted = useCallback(
    (id: string) => {
      const deleted = materials.find((m) => m.id === id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      const reply: TutorMessage = {
        id: `t-mat-del-${Date.now()}`,
        role: "tutor",
        text: `「${deleted?.name ?? id}」を削除したよ。\n（現状は mock のため関連する学習計画やスケジュールには影響しません。Phase 7 永続化で整合化予定。）`,
        createdAt: new Date().toISOString(),
      };
      setTutorMessages((prev) => [...prev, reply]);
      navigate("materials");
    },
    [materials, navigate],
  );

  // ----- 教材追加完了時のゆい発話追加 + 右ペイン遷移 -----
  // C32 2026-05-25 grill 1 確定 13: アップ完了動線 = ゆいから「葵が読んだよ、見る?」
  // → 右ペインに material-detail (体系図 + 評価コメント + 葵 chat) 即時展開
  // 暫定: MOCK_MATERIALS への動的 push は未実装 (Step4Save が console.log のみ)。
  // 表示は MOCK_MATERIALS の先頭 (= 中2英語教科書) を仮表示。Phase 7 で永続化対応。
  const handleMaterialAdded = useCallback(
    (materialName: string, approvedNodeCount: number) => {
      const reply: TutorMessage = {
        id: `t-mat-${Date.now()}`,
        role: "tutor",
        text: `「${materialName}」、葵先生が読んだよ！\n体系図 (${approvedNodeCount} ノード) と評価コメントをまとめてくれたから、右で見せるね。`,
        createdAt: new Date().toISOString(),
      };
      setTutorMessages((prev) => [...prev, reply]);
      const fallbackMaterialId = MOCK_MATERIALS[0]?.id;
      if (fallbackMaterialId) {
        navigate("material-detail", { materialId: fallbackMaterialId });
      } else {
        navigate("default");
      }
    },
    [navigate],
  );

  // ----- C30 2026-05-25 grill 2: 科目追加完了時の処理 -----
  // SubjectSettingsPanel から呼ばれる。新規 Subject を生成して subjects state に追加、
  // ゆいに完了発話を追加して右ペインを閉じる (S7 主体: 親+娘さん両方が使う動線)。
  // MOCK_SUBJECTS にも push して他画面 (admin 等) でも見えるようにする (in-memory mock)。
  const handleSubjectAdded = useCallback(
    (input: { name: string; teacherName: string; avatarLetter: string }) => {
      const newSubject: Subject = {
        id: `subj-manual-${Date.now()}`,
        name: input.name,
        teacher: {
          name: input.teacherName,
          displayName: `${input.teacherName}先生`,
          avatarLetter: input.avatarLetter,
          subtitle: `${input.name}の先生`,
        },
      };
      setSubjects((prev) => [...prev, newSubject]);
      // mock-data 側にも push (admin/materials/new など他経路から見える)
      MOCK_SUBJECTS.push(newSubject);
      const reply: TutorMessage = {
        id: `t-subj-${Date.now()}`,
        role: "tutor",
        text: `「${input.name}」追加したよ！${input.teacherName}先生がこの教科を担当するよ。\nこれで計画立案や教材登録で選べるようになったよ。`,
        createdAt: new Date().toISOString(),
      };
      setTutorMessages((prev) => [...prev, reply]);
      navigate("default");
    },
    [navigate],
  );

  // ----- ゆい chat: 返信生成（mock + rightPaneAction 適用） -----
  const generateReply = useCallback(
    ({ userInput }: { userInput: string; history: TutorMessage[] }): TutorMessage => {
      const result = buildNextTutorReply({
        state: tutorStepRef.current,
        userInput,
      });
      tutorStepRef.current = result.nextState;
      if (result.reply.rightPaneAction) {
        applyRightPaneAction(result.reply.rightPaneAction);
      }
      return result.reply;
    },
    [applyRightPaneAction],
  );

  const onPickSubject = useCallback(
    (subjectId: string): TutorMessage => {
      // C8: 計画立案フロー中なら plan-await-material へ、それ以外は subject-picked へ
      const isPlanFlow = tutorStepRef.current.state === "plan-await-subject";
      tutorStepRef.current = {
        ...tutorStepRef.current,
        state: isPlanFlow ? "plan-await-material" : "subject-picked",
        proposedSubjectId: subjectId,
      };
      const result = buildNextTutorReply({
        state: tutorStepRef.current,
        userInput: "",
      });
      tutorStepRef.current = result.nextState;
      if (result.reply.rightPaneAction) {
        applyRightPaneAction(result.reply.rightPaneAction);
      }
      return result.reply;
    },
    [applyRightPaneAction],
  );

  const onPickMaterial = useCallback(
    (materialId: string): TutorMessage => {
      // C8: 計画立案フロー中なら plan-await-duration へ、それ以外は material-picked へ
      const isPlanFlow = tutorStepRef.current.state === "plan-await-material";
      tutorStepRef.current = {
        ...tutorStepRef.current,
        state: isPlanFlow ? "plan-await-duration" : "material-picked",
        proposedMaterialId: materialId,
      };
      const result = buildNextTutorReply({
        state: tutorStepRef.current,
        userInput: "",
      });
      tutorStepRef.current = result.nextState;
      if (result.reply.rightPaneAction) {
        applyRightPaneAction(result.reply.rightPaneAction);
      }
      return result.reply;
    },
    [applyRightPaneAction],
  );

  // C8 Phase 4: 計画立案の duration-picker 選択ハンドラ
  // C17 Phase 5 P5-Q2: weak-node-picker を間に挟むため遷移先を変更
  const onPickDuration = useCallback(
    (monthsPerRotation: number, rotations: number): TutorMessage => {
      tutorStepRef.current = {
        ...tutorStepRef.current,
        state: "plan-await-weak-nodes",
        proposedMonthsPerRotation: monthsPerRotation,
        proposedRotations: rotations,
      };
      const result = buildNextTutorReply({
        state: tutorStepRef.current,
        userInput: "",
      });
      tutorStepRef.current = result.nextState;
      if (result.reply.rightPaneAction) {
        applyRightPaneAction(result.reply.rightPaneAction);
      }
      return result.reply;
    },
    [applyRightPaneAction],
  );

  // C17 Phase 5 P5-Q2: weak-node-picker 選択ハンドラ
  // 本人がチェックボックスで弱いノードを選び終わると発火、確定して roadmap-preview へ
  const onPickWeakNodes = useCallback(
    (weakNodeIds: string[]): TutorMessage => {
      tutorStepRef.current = {
        ...tutorStepRef.current,
        state: "plan-await-confirm",
        proposedWeakNodeIds: weakNodeIds,
      };
      const result = buildNextTutorReply({
        state: tutorStepRef.current,
        userInput: "",
      });
      tutorStepRef.current = result.nextState;
      if (result.reply.rightPaneAction) {
        applyRightPaneAction(result.reply.rightPaneAction);
      }
      return result.reply;
    },
    [applyRightPaneAction],
  );

  // ----- Issue 操作 -----
  const handleResolveIssue = useCallback((issueId: string) => {
    setIssues((prev) =>
      prev.map((i) =>
        i.id === issueId
          ? {
              ...i,
              status: "resolved",
              resolvedAt: new Date().toISOString(),
              aiSuggestedClear: false,
              aiSuggestedClearReason: undefined,
            }
          : i,
      ),
    );
  }, []);

  const handleReopenIssue = useCallback((issueId: string) => {
    setIssues((prev) =>
      prev.map((i) =>
        i.id === issueId
          ? { ...i, status: "open", resolvedAt: undefined }
          : i,
      ),
    );
  }, []);

  const handleAppendChatMessages = useCallback(
    (issueId: string, msgs: IssueChatMessage[]) => {
      setIssues((prev) =>
        prev.map((i) =>
          i.id === issueId
            ? { ...i, chatThread: [...(i.chatThread ?? []), ...msgs] }
            : i,
        ),
      );
    },
    [],
  );

  // 右ペインに課題 chat が出ている時、左ゆい入力欄を無効化する
  // （subject-history 等の他 view では左ゆいは常時アクティブ）
  const tutorLocked = view === "issue";

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* スリムな上部 app bar — AI-Education ブランディング + 学習画面への移動 */}
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-background px-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-accent"
          title="ホーム（ゆい先生）"
        >
          <BookOpenCheck className="size-5 text-primary" />
          <span className="font-heading text-sm font-medium">
            AI-Education
          </span>
        </Link>
        <span className="text-xs text-muted-foreground">/ ゆい先生</span>
        <Link href="/learn" title="学習画面へ">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            aria-label="学習画面へ"
          >
            <GraduationCap className="size-3.5" />
            <span>学習画面</span>
          </Button>
        </Link>
      </header>

      <ResizablePanelGroup
        orientation="horizontal"
        className="flex min-h-0 flex-1"
      >
        {/* 左: ゆい chat（常駐。コーチング設計 + 「葵 chat 見ながら段取り依頼」
            ユースケースのため、subject-history view でも引っ込まない） */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <TutorChat
            initialMessages={tutorMessages}
            messages={tutorMessages}
            setMessages={setTutorMessages}
            nodes={nodes}
            issues={issues}
            scheduleItems={scheduleToday}
            subjects={subjects}
            generateReply={generateReply}
            onPickSubject={onPickSubject}
            onPickMaterial={onPickMaterial}
            onPickDuration={onPickDuration}
            onPickWeakNodes={onPickWeakNodes}
            externallyLocked={tutorLocked}
            externalLockMessage={
              tutorLocked
                ? "課題の対話中… 右で科目の先生と話してね"
                : undefined
            }
            onSelectIssue={(id) => navigate("issue", { issueId: id })}
            onSeeAllIssues={() => navigate("issues")}
            onSelectIssueItem={(id) => navigate("issue", { issueId: id })}
            onSeeAllSchedule={() => navigate("today-tasks")}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右: 動的展開エリア */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <RightPaneRouter
            view={view}
            selectedIssue={selectedIssue}
            selectedSubjectId={selectedSubjectId}
            selectedMaterialId={selectedMaterialId}
            issues={issues}
            nodes={nodes}
            chatMessages={chatMessages}
            scheduleToday={scheduleToday}
            scheduleUpcoming={scheduleUpcoming}
            exams={exams}
            homeworks={homeworks}
            lessonReviews={lessonReviews}
            subjects={subjects}
            sessions={sessions}
            onResolveIssue={handleResolveIssue}
            onReopenIssue={handleReopenIssue}
            onAppendChatMessages={handleAppendChatMessages}
            onSelectIssue={(id) => navigate("issue", { issueId: id })}
            onSelectIssueItem={(id) => navigate("issue", { issueId: id })}
            onBack={() => navigate("default")}
            onMaterialAdded={handleMaterialAdded}
            onMaterialUpdated={handleMaterialUpdated}
            onMaterialDeleted={handleMaterialDeleted}
            onSubjectAdded={handleSubjectAdded}
            materials={materials}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
