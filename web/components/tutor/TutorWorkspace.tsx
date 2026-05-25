"use client";

/**
 * TutorWorkspace - /tutor の 2 ペイン司令室（Phase 3）。
 *
 * 構造:
 *   - 左ペイン: TutorChat（ゆい先生との会話）
 *   - 右ペイン: RightPaneRouter（?view= に応じて IssueListView / IssueChat / ScheduleDashboard / HistoryView を切替）
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
  type TutorStep,
} from "@/lib/learn/tutor-mock";
import { formatLocalDate } from "@/lib/learn/session-storage";
import {
  loadTutorThread,
  saveTutorThread,
} from "@/lib/learn/tutor-thread-storage";
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
    raw === "schedule" ||
    raw === "history" ||
    raw === "reflections" ||
    raw === "material-new" ||
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
  subjects,
  sessions,
  chatMessages,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = viewFromParam(searchParams.get("view"));
  const selectedIssueId = searchParams.get("id");
  const selectedSubjectId = searchParams.get("subjectId");
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
  }, [tutorMessages]);

  // ----- Issue state（resolve / chatThread 追加を一元管理） -----
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  // Today schedule（done トグル等は ScheduleDashboard 内で完結するが、
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
      params?: { issueId?: string; subjectId?: string },
    ) => {
      const url = new URLSearchParams();
      if (next !== "default") url.set("view", next);
      if (next === "issue" && params?.issueId) url.set("id", params.issueId);
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
        case "open-schedule":
          navigate("schedule");
          break;
        case "open-history":
          navigate("history");
          break;
        case "open-reflections":
          navigate("reflections");
          break;
        case "open-material-new":
          navigate("material-new");
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

  // ----- 教材追加完了時のゆい発話追加 + 右ペインクローズ -----
  const handleMaterialAdded = useCallback(
    (materialName: string, approvedNodeCount: number) => {
      const reply: TutorMessage = {
        id: `t-mat-${Date.now()}`,
        role: "tutor",
        text:
          approvedNodeCount > 0
            ? `「${materialName}」、登録できたよ！\n体系図に ${approvedNodeCount} 個のノードが追加されたよ。`
            : `「${materialName}」、登録できたよ！\n（承認ノードは 0 件だったから、体系図には追加されてないよ）`,
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
  const onPickDuration = useCallback(
    (monthsPerRotation: number, rotations: number): TutorMessage => {
      tutorStepRef.current = {
        ...tutorStepRef.current,
        state: "plan-await-confirm",
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
            externallyLocked={tutorLocked}
            externalLockMessage={
              tutorLocked
                ? "課題の対話中… 右で科目の先生と話してね"
                : undefined
            }
            onSelectIssue={(id) => navigate("issue", { issueId: id })}
            onSeeAllIssues={() => navigate("issues")}
            onSelectIssueItem={(id) => navigate("issue", { issueId: id })}
            onSeeAllSchedule={() => navigate("schedule")}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右: 動的展開エリア */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <RightPaneRouter
            view={view}
            selectedIssue={selectedIssue}
            selectedSubjectId={selectedSubjectId}
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
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
