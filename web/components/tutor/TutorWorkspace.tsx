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
import { BookOpenCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorChat } from "./TutorChat";
import { RightPaneRouter } from "./RightPaneRouter";
import { AssignmentDialog } from "@/components/materials/AssignmentDialog";
import { MaterialReadPane } from "@/components/materials/MaterialReadPane";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import {
  getCurrentUserId,
  type NewAssignmentInput,
} from "@/lib/materials/materials-repo";
import {
  fetchNoteEntries,
  updateNoteEntry,
  softDeleteNoteEntry,
} from "@/lib/notes/notes-repo";
import { useIssues } from "@/hooks/use-issues";
import {
  fetchResumes,
  insertResume,
  renameResume,
  setDefaultResume,
  softDeleteResume,
  moveEntryToResume,
  moveEntryToSubject,
  ensureDefaultResume,
  copyResume,
  updateResumeOutline,
} from "@/lib/notes/resumes-repo";
import {
  buildResumeOutlineViaClaude,
  suggestOutlinePlacement,
} from "@/lib/notes/outline-claude";
import {
  sanitizeOutline,
  buildFallbackOutline,
  toRoman,
} from "@/lib/notes/resume-outline";
import {
  ensureDefaultEventLabels,
  insertEventLabel,
  updateEventLabel,
  softDeleteEventLabel,
} from "@/lib/schedule/event-labels-repo";
import {
  fetchCalendarEvents,
  insertCalendarEvent,
  updateCalendarEvent,
  softDeleteCalendarEvent,
  type CalendarEventInput,
} from "@/lib/schedule/calendar-events-repo";
import { useLearningHistory } from "@/hooks/use-learning-history";
import { useDailyPicks } from "@/hooks/use-daily-picks";
import { usePlans } from "@/hooks/use-plans";
import { useSubjects } from "@/hooks/use-subjects";
import { useMaterials } from "@/hooks/use-materials";
import { getPlanSegments } from "@/lib/plans/plan-progress";
import { streamNdjsonText } from "@/lib/ai/stream-client";
import type { TutorClaudeRequest } from "@/lib/learn/tutor-chat-shared";
import { DEFAULT_EVENT_LABELS } from "@/lib/learn/event-colors";
import {
  buildInitialTutorThread,
  buildNextTutorReply,
  prepareTutorReply,
  EVENING_RITUAL_LAST_DATE_KEY,
  MORNING_MODE_ENABLED,
  emptySchoolReportDraft,
  shouldStartEveningRitual,
  type TutorStep,
} from "@/lib/learn/tutor-mock";
import { formatLocalDate } from "@/lib/learn/session-storage";
import {
  loadTutorThread,
  saveTutorThread,
} from "@/lib/learn/tutor-thread-storage";
import type {
  AssignmentStatus,
  CalendarEvent,
  ChatMessage,
  EventLabel,
  EventLabelColor,
  ExamPrep,
  Homework,
  Issue,
  KnowledgeNode,
  LearningSession,
  LessonReview,
  Material,
  NoteEntry,
  Resume,
  ResumeOutlineSection,
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
    raw === "material-read" || // 段階1-C 2026-06-04: 一緒にめくって読む読書ビュー
    raw === "materials" || // C44 2026-05-26: 教材一覧 (ito19 さん意見、残課題⑤ 解消)
    raw === "subjects" || // C30 2026-05-25 grill 2 S6
    raw === "subject-history" ||
    raw === "tutor-archive" ||
    raw === "notes" // まとめノート N9① 2026-06-05
  ) {
    return raw;
  }
  return "default";
}

export function TutorWorkspace({
  nodes,
  initialIssues,
  initialScheduleToday,
  subjects: initialSubjects,
  chatMessages,
}: Props) {
  // C30 2026-05-25 grill 2 S7: 科目追加対応で subjects を state 管理
  // (SubjectSettingsPanel から動的追加される)。
  // Phase 3 モノリス分割 (2026-06-12): 科目ドメインは useSubjects に抽出。
  const { subjects, addSubject } = useSubjects(initialSubjects);
  // C46 2026-05-26 F (ito19 さん意見): 教材編集・削除のため materials を state 管理。
  // Phase 3 モノリス分割 (2026-06-12): 教材ドメインは useMaterials に抽出。
  const {
    materials,
    materialsLoaded,
    materialsLoadState,
    handleMaterialUpdated,
    handleCoverThumb,
    handleGuidedPlansSaved,
    removeMaterial,
    handleSubmitAssignment,
    handleDeleteAssignment,
    setAssignmentStatus,
    handleMaterialAdded: addMaterialWithUiHooks,
    refetchMaterials,
    resegmentMaterial,
  } = useMaterials(subjects);

  // まとめノート N9①: ノートエントリ。real は DB fetch、mock は in-memory。
  const [noteEntries, setNoteEntries] = useState<NoteEntry[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchNoteEntries()
      .then((rows) => {
        if (!cancelled) setNoteEntries(rows);
      })
      .catch((err) => console.error("[ノート] 一覧取得失敗:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  // R10 Phase 2: レジュメ冊。real は起動時 DB fetch、mock は空 (1 科目 1 冊運用なら
  // resume レコードなしでも Phase 1 同様に科目スコープ表示は成立する)。
  const [resumes, setResumes] = useState<Resume[]>([]);
  // 初期 fetch 完了フラグ。デフォルト冊の自動確保 effect がこの後に走るようにして、
  // fetch の setResumes(rows) で新規冊が上書き消去されるレースを防ぐ。
  const [resumesLoaded, setResumesLoaded] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchResumes()
      .then((rows) => {
        if (!cancelled) setResumes(rows);
      })
      .catch((err) => console.error("[レジュメ冊] 一覧取得失敗:", err))
      .finally(() => {
        if (!cancelled) setResumesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // R10: エントリのある科目には必ず「デフォルト冊」を確保する (2026-06-09 ito19 さん指摘)。
  // 英語など R10 以前に作られたエントリは resume レコードが無く、NotesHomeView の
  // 冊タブ (＝「冊を追加」ボタン) が出ない。ensureDefaultResume は既存チェック付きで、
  // 無ければ作成 + 同科目の未割当ピースを backfill する (古いエントリの resume_id も補修)。
  const ensuredSubjectsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (!resumesLoaded || noteEntries.length === 0) return;
    const subjectsWithEntries = new Set(
      noteEntries.filter((e) => !e.deletedAt).map((e) => e.subjectId),
    );
    const haveDefault = new Set(
      resumes
        .filter((r) => r.isDefault && !r.deletedAt)
        .map((r) => r.subjectId),
    );
    const missing = [...subjectsWithEntries].filter(
      (sid) => !haveDefault.has(sid) && !ensuredSubjectsRef.current.has(sid),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const ownerId = await getCurrentUserId();
        for (const sid of missing) {
          // 二重実行を防ぐため先に記録 (await をまたいでも重複しない)
          ensuredSubjectsRef.current.add(sid);
          const subjectName =
            subjects.find((s) => s.id === sid)?.name ?? "その他";
          const resume = await ensureDefaultResume(sid, subjectName, ownerId);
          if (cancelled) return;
          setResumes((prev) =>
            prev.some((r) => r.id === resume.id) ? prev : [...prev, resume],
          );
        }
      } catch (err) {
        console.error("[レジュメ冊] デフォルト冊の自動確保に失敗:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumesLoaded, noteEntries, resumes, subjects]);

  // ----- 予定 (カレンダー) のラベル + 手動イベント (2026-06-09) -----
  // real は DB から (ラベルはオンデマンドシード)、mock はデフォルトラベルをローカルに。
  const [eventLabels, setEventLabels] = useState<EventLabel[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEventLabels(
        DEFAULT_EVENT_LABELS.map((d, i) => ({
          id: `label-local-${i}`,
          name: d.name,
          color: d.color,
          kind: d.kind,
        })),
      );
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ownerId = await getCurrentUserId();
        const labels = await ensureDefaultEventLabels(ownerId);
        if (!cancelled) setEventLabels(labels);
      } catch (err) {
        console.error("[予定] ラベル取得失敗:", err);
      }
      try {
        const events = await fetchCalendarEvents();
        if (!cancelled) setCalendarEvents(events);
      } catch (err) {
        console.error("[予定] イベント取得失敗:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddEvent = useCallback(async (input: CalendarEventInput) => {
    if (isSupabaseConfigured()) {
      try {
        const ownerId = await getCurrentUserId();
        const created = await insertCalendarEvent(input, ownerId);
        setCalendarEvents((prev) => [...prev, created]);
        return;
      } catch (err) {
        console.error("[予定] 追加失敗、in-memory にフォールバック:", err);
      }
    }
    setCalendarEvents((prev) => [
      ...prev,
      {
        id: `event-local-${Date.now()}`,
        title: input.title,
        date: input.date,
        labelId: input.labelId,
        time: input.time,
        memo: input.memo,
      },
    ]);
  }, []);

  const handleUpdateEvent = useCallback(
    async (id: string, patch: Partial<CalendarEventInput>) => {
      if (isSupabaseConfigured()) {
        try {
          await updateCalendarEvent(id, patch);
        } catch (err) {
          console.error("[予定] 更新失敗:", err);
        }
      }
      setCalendarEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      );
    },
    [],
  );

  const handleDeleteEvent = useCallback(async (id: string) => {
    if (isSupabaseConfigured()) {
      try {
        await softDeleteCalendarEvent(id);
      } catch (err) {
        console.error("[予定] 削除失敗:", err);
      }
    }
    setCalendarEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleAddLabel = useCallback(
    async (name: string, color: EventLabelColor) => {
      if (isSupabaseConfigured()) {
        try {
          const ownerId = await getCurrentUserId();
          const created = await insertEventLabel(name, color, ownerId);
          setEventLabels((prev) => [...prev, created]);
          return;
        } catch (err) {
          console.error("[予定] ラベル追加失敗:", err);
        }
      }
      setEventLabels((prev) => [
        ...prev,
        { id: `label-local-${Date.now()}`, name, color, kind: "normal" },
      ]);
    },
    [],
  );

  const handleUpdateLabel = useCallback(
    async (id: string, patch: { name?: string; color?: EventLabelColor }) => {
      if (isSupabaseConfigured()) {
        try {
          await updateEventLabel(id, patch);
        } catch (err) {
          console.error("[予定] ラベル更新失敗:", err);
        }
      }
      setEventLabels((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      );
    },
    [],
  );

  const handleDeleteLabel = useCallback(async (id: string) => {
    if (isSupabaseConfigured()) {
      try {
        await softDeleteEventLabel(id);
      } catch (err) {
        console.error("[予定] ラベル削除失敗:", err);
      }
    }
    setEventLabels((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const calendarApi = useMemo(
    () => ({
      labels: eventLabels,
      events: calendarEvents,
      onAddEvent: handleAddEvent,
      onUpdateEvent: handleUpdateEvent,
      onDeleteEvent: handleDeleteEvent,
      onAddLabel: handleAddLabel,
      onUpdateLabel: handleUpdateLabel,
      onDeleteLabel: handleDeleteLabel,
    }),
    [
      eventLabels,
      calendarEvents,
      handleAddEvent,
      handleUpdateEvent,
      handleDeleteEvent,
      handleAddLabel,
      handleUpdateLabel,
      handleDeleteLabel,
    ],
  );

  // ----- 新プラン (ザックリ・まとまりキュー型、2026-06-10 grill 確定) -----
  // Phase 3 モノリス分割 (2026-06-12): プランドメインは usePlans に抽出。
  const {
    plans,
    plansLoaded,
    handleCreatePlan,
    handleExtendPlan,
    handleCompletePlan,
    handleRestartPlan,
    handleTogglePlanSkip,
    handleDeletePlan,
    removePlansForMaterial,
  } = usePlans(materials);

  // ----- 「その日決める枠」の pick (Phase B、2026-06-11 grill B-1〜B-8) -----
  // Phase 3 モノリス分割 (2026-06-12): daily picks ドメインは useDailyPicks に抽出。
  const {
    dayPicks,
    dayPicksLoaded,
    dayPickedKeys,
    addDayPick,
    handleRemoveDayPick,
    observeDayPickDone,
    observeDayPickUndone,
    removePicksForMaterial,
  } = useDailyPicks();

  // ----- 学習履歴 (出来事ログ + 学習時間、2026-06-10 grill 確定) -----
  // Phase 3 モノリス分割 (2026-06-12): 学習履歴ドメインは useLearningHistory に抽出。
  const { learningLogs, studyMinutes, addLearningLog, handleStudyMinute } =
    useLearningHistory();

  const router = useRouter();
  const searchParams = useSearchParams();
  const view = viewFromParam(searchParams.get("view"));
  const selectedIssueId = searchParams.get("id");
  const selectedSubjectId = searchParams.get("subjectId");
  // C32 2026-05-25 grill 1: material-detail view では id クエリを materialId として解釈
  // 段階1-C: material-read (読書ビュー) でも同じく id を materialId として使う
  const selectedMaterialId =
    searchParams.get("view") === "material-detail" ||
    searchParams.get("view") === "material-read"
      ? searchParams.get("id")
      : null;
  // まとまり生成ジョブ化 (2026-06-13): 教材まわりの view に入るたび教材一覧を取り直し、
  // サーバージョブが更新した segment_status / concept_segments を反映する (遷移時 fetch、
  // Realtime 不使用)。view 変化の 1 回だけ発火 (refetchMaterials は安定参照)。
  useEffect(() => {
    if (
      view === "materials" ||
      view === "material-detail" ||
      view === "material-read"
    ) {
      void refetchMaterials();
    }
  }, [view, selectedMaterialId, refetchMaterials]);

  // 段階1-C: 読書ビューの初期ページ (体系図ノードから ?page=N で飛んできた時)
  const readInitialPage = (() => {
    const raw = searchParams.get("page");
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isNaN(n) || n < 1 ? undefined : n;
  })();
  // 教材詳細の「読む」(まとまりごと) から来た時 (&unit=1): 該当まとまりを
  // 「選択した段階」で開く (いきなりガイド読書を始めない、2026-06-08)。
  const readSelectUnit = searchParams.get("unit") === "1";
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
        freshToday: false,
      };
    }

    if (existingMessages.length > 0) {
      // 同日継続: 復元
      return {
        messages: existingMessages,
        state: (stored?.state ?? "reflection-yesterday") as TutorStep["state"],
        endingVentItems: stored?.endingVentItems ?? [],
        freshToday: false,
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
        freshToday: false,
      };
    }

    // 今日初めて: 朝の挨拶で新規 thread
    // D5 (2026-05-27 確定): 中学生向け朝振り返り廃止。MORNING_MODE_ENABLED=false の
    // 時は morning モードのハブ挨拶のみ + state を reflection-plan (振り返り完了相当 =
    // 通常 chat 受付状態) で起動 = 5 セクション質問に巻き込まれずに本人がメニュー操作できる
    // Phase B (grill B-8): 今日の thread がまだ無い = その日最初。
    // データロード後に「今日なにやる?」候補カードを続けて append する。
    return {
      messages: buildInitialTutorThread(new Date(), "morning").messages,
      state: (MORNING_MODE_ENABLED
        ? "reflection-yesterday"
        : "reflection-plan") as TutorStep["state"],
      endingVentItems: [] as string[],
      freshToday: true,
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
  // Phase 3 モノリス分割 (2026-06-12): 課題ドメインは useIssues に抽出。
  const {
    issues,
    handleResolveIssue,
    handleReopenIssue,
    handleAssignmentIssues,
    handleAppendChatMessages,
  } = useIssues(initialIssues);
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
      params?: {
        issueId?: string;
        subjectId?: string;
        materialId?: string;
        /** 段階1-C: material-read の初期ページ (体系図ノードジャンプ用) */
        page?: number;
        /** 教材ペインの初期タブ ("books" | "assignments"、2026-06-09) */
        tab?: string;
        /** material-read で該当まとまりを「選択した段階」で開く (&unit=1、2026-06-10) */
        unit?: boolean;
      },
    ) => {
      const url = new URLSearchParams();
      if (next !== "default") url.set("view", next);
      if (next === "issue" && params?.issueId) url.set("id", params.issueId);
      if (next === "material-detail" && params?.materialId)
        url.set("id", params.materialId);
      if (next === "material-read" && params?.materialId) {
        url.set("id", params.materialId);
        if (params.page && params.page > 0) url.set("page", String(params.page));
        if (params.unit) url.set("unit", "1");
      }
      // 教材ペインの初期タブ (ダッシュボード「宿題・テスト すべて見る」→ assignments)
      if (next === "materials" && params?.tab) url.set("tab", params.tab);
      if (next === "subject-history" && params?.subjectId)
        url.set("subjectId", params.subjectId);
      // R10: 出典→レジュメ 往復。notes view に科目を渡して該当タブを初期選択する。
      if (next === "notes" && params?.subjectId)
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
        case "open-notes":
          navigate("notes");
          break;
        case "close":
          navigate("default");
          break;
      }
    },
    [navigate],
  );

  // ----- 教材削除 (C46 F、ito19 さん意見): in-memory 削除 + ゆい発話 + 一覧に戻す -----
  // 教材ドメイン部分 (state + 論理削除 + PDF 実体削除) は useMaterials (removeMaterial)。
  // ここは他ドメイン連鎖 (プラン/pick の連鎖掃除) + ゆい発話 + 遷移。
  const handleMaterialDeleted = useCallback(
    (id: string) => {
      const deleted = removeMaterial(id);
      // ★連鎖掃除 (2026-06-12 レビュー指摘)★: 教材は論理削除なので DB の
      // on delete cascade は永久に発火しない。掃除しないと、この教材のプランが
      // 「教材なしのゾンビカード」として残り、きょう決めたこと (daily_picks) も
      // DB に永久残留していた。プランは論理削除、pick は「やめとく」と同じ扱いで外す。
      const orphanPlanCount = removePlansForMaterial(id);
      removePicksForMaterial(id);
      const reply: TutorMessage = {
        id: `t-mat-del-${Date.now()}`,
        role: "tutor",
        text: `「${deleted?.name ?? id}」を削除したよ。${
          orphanPlanCount > 0 ? "\nこの教材のプランも一緒に終了したよ。" : ""
        }`,
        createdAt: new Date().toISOString(),
      };
      setTutorMessages((prev) => [...prev, reply]);
      navigate("materials");
    },
    [removeMaterial, removePlansForMaterial, removePicksForMaterial, navigate],
  );

  // 宿題・テストの状態トグル: state + DB は useMaterials (setAssignmentStatus)。
  // ここは学習履歴 (自動) + 今日の枠 (pick) の完了観測。
  const handleToggleAssignmentStatus = useCallback(
    (id: string, status: AssignmentStatus) => {
      // 履歴 (自動): 「やった」にした時だけ記録 (戻した時は記録しない)
      if (status === "done") {
        const target = materials.find((m) => m.id === id);
        if (target) {
          addLearningLog({
            kind: "assignment-done",
            subjectId: target.subjectId,
            materialId: target.id,
            title: target.name,
          });
        }
      }
      // Phase B: 今日の枠 (pick) に入っていれば完了/取消を観測する
      if (status === "done") observeDayPickDone(id);
      else observeDayPickUndone(id);
      setAssignmentStatus(id, status);
    },
    [
      materials,
      addLearningLog,
      observeDayPickDone,
      observeDayPickUndone,
      setAssignmentStatus,
    ],
  );

  // ----- まとめノート N9①: 能動ゲート通過でエントリが刻まれた時 -----
  const handleNoteAdded = useCallback(
    (entry: NoteEntry) => {
      // 履歴 (自動): 仕上げた (understood) / 途中 (open) を記録
      addLearningLog({
        kind: entry.status === "understood" ? "resume-done" : "resume-draft",
        subjectId: entry.subjectId,
        materialId: entry.sourceMaterialId,
        segmentId: entry.sourceSegmentId,
        title: entry.conceptName,
      });
      // Phase B: 今日の枠 (pick) のまとまりを仕上げたら完了を観測する
      if (
        entry.status === "understood" &&
        entry.sourceMaterialId &&
        entry.sourceSegmentId
      ) {
        observeDayPickDone(entry.sourceMaterialId, entry.sourceSegmentId);
      }
      // upsert: 2 周目の深化更新 (同じ id) は置換、新規は追加 (G-C で重複を防ぐ)。
      const isNewEntry = !noteEntries.some((e) => e.id === entry.id);
      setNoteEntries((prev) =>
        prev.some((e) => e.id === entry.id)
          ? prev.map((e) => (e.id === entry.id ? entry : e))
          : [...prev, entry],
      );
      // R11-②: 刻んだ瞬間の配置提案 (grill R11-2) — 入れ先の冊にアウトラインが
      // あれば AI (Haiku) が章を判定して末尾に配置。合う章が無い/失敗は未整理のまま
      // (「作り直す」か言葉で直すで救える)。違ったらレジュメ画面で言葉で直す。
      const targetResume = entry.resumeId
        ? resumes.find((r) => r.id === entry.resumeId)
        : undefined;
      if (
        isNewEntry &&
        targetResume?.outline &&
        targetResume.outline.length > 0 &&
        process.env.NEXT_PUBLIC_USE_CLAUDE_API === "true"
      ) {
        const outline = targetResume.outline;
        void (async () => {
          try {
            const subjectName =
              subjects.find((s) => s.id === entry.subjectId)?.name ?? "教科";
            const { sectionIndex } = await suggestOutlinePlacement({
              subjectName,
              conceptName: entry.conceptName,
              bodyHead: entry.aiSummary.slice(0, 200),
              sectionTitles: outline.map((s) => s.title),
            });
            if (sectionIndex < 0) return;
            const sec = outline[sectionIndex];
            const nextOutline = outline.map((s, i) =>
              i === sectionIndex
                ? { ...s, entryIds: [...s.entryIds, entry.id] }
                : s,
            );
            setResumes((prev) =>
              prev.map((r) =>
                r.id === targetResume.id ? { ...r, outline: nextOutline } : r,
              ),
            );
            if (isSupabaseConfigured()) {
              await updateResumeOutline(targetResume.id, nextOutline);
            }
            setTutorMessages((prev) => [
              ...prev,
              {
                id: `t-place-${Date.now()}`,
                role: "tutor",
                text: `レジュメの「${toRoman(sectionIndex + 1)} ${sec.title}」に入れたよ📒 違ったらレジュメ画面で言葉で直してね。`,
                createdAt: new Date().toISOString(),
              },
            ]);
          } catch (err) {
            console.error("[レジュメ] 配置提案失敗 (未整理のまま):", err);
          }
        })();
      }
      const text =
        entry.status === "open"
          ? `「${entry.conceptName}」を「振り返りたい」としてレジュメに残したよ📌\nあとでまた一緒に見て、自分の言葉で説明できたら理解済みにしよう。メニューの「レジュメ」から振り返れるよ。`
          : `レジュメに 1 つ追加したね ✍️「${entry.conceptName}」\n自分の言葉で説明できたから、これは身についてる証拠だよ。メニューの「レジュメ」でいつでも見返せるよ。`;
      const reply: TutorMessage = {
        id: `t-note-${Date.now()}`,
        role: "tutor",
        text,
        createdAt: new Date().toISOString(),
      };
      setTutorMessages((prev) => [...prev, reply]);
    },
    [addLearningLog, observeDayPickDone, noteEntries, resumes, subjects],
  );

  const handleNoteUpdated = useCallback(
    (id: string, patch: { userNote?: string; status?: "understood" | "open" }) => {
      // 履歴 (自動): 振り返りで open → understood に昇格した時を記録
      if (patch.status === "understood") {
        const entry = noteEntries.find((e) => e.id === id);
        if (entry && entry.status === "open") {
          addLearningLog({
            kind: "review-promote",
            subjectId: entry.subjectId,
            materialId: entry.sourceMaterialId,
            segmentId: entry.sourceSegmentId,
            title: entry.conceptName,
          });
        }
        // Phase B: 今日の枠 (pick) のまとまりが昇格で済みになったら完了を観測する
        if (entry?.sourceMaterialId && entry.sourceSegmentId) {
          observeDayPickDone(entry.sourceMaterialId, entry.sourceSegmentId);
        }
      }
      setNoteEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? // updatedAt も載せる (2026-06-12 レビュー指摘): 2 周目プラン (countFrom) の
              // 進捗は updatedAt >= countFrom で導出するため、in-memory が古いままだと
              // リロードするまでダッシュボードの「済み」が動かなかった。
              { ...e, ...patch, updatedAt: new Date().toISOString() }
            : e,
        ),
      );
      if (isSupabaseConfigured()) {
        void updateNoteEntry(id, patch).catch((err) =>
          console.error("[ノート] 更新失敗:", err),
        );
      }
    },
    [noteEntries, addLearningLog, observeDayPickDone],
  );

  const handleNoteDeleted = useCallback((id: string) => {
    setNoteEntries((prev) => prev.filter((e) => e.id !== id));
    if (isSupabaseConfigured()) {
      void softDeleteNoteEntry(id).catch((err) =>
        console.error("[ノート] 削除失敗:", err),
      );
    }
  }, []);

  // ----- R10 Phase 2: レジュメ冊 管理 + ピースの別冊振り分け -----
  // すべて楽観更新 (先に state、裏で DB)。mock モードはローカル id で完結。

  /** 冊を追加 (同科目)。is_default=false。作成した Resume を返す (新冊への移動/選択用)。 */
  const handleAddResume = useCallback(
    async (subjectId: string, name: string): Promise<Resume | null> => {
      if (isSupabaseConfigured()) {
        try {
          const ownerId = await getCurrentUserId();
          const created = await insertResume(subjectId, name, ownerId);
          setResumes((prev) => [...prev, created]);
          return created;
        } catch (err) {
          console.error("[レジュメ冊] 追加失敗、in-memory にフォールバック:", err);
        }
      }
      const local: Resume = {
        id: `resume-local-${Date.now()}`,
        subjectId,
        name,
        isDefault: false,
      };
      setResumes((prev) => [...prev, local]);
      return local;
    },
    [],
  );

  /** 冊名のリネーム。 */
  const handleRenameResume = useCallback((id: string, name: string) => {
    setResumes((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
    if (isSupabaseConfigured()) {
      void renameResume(id, name).catch((err) =>
        console.error("[レジュメ冊] リネーム失敗:", err),
      );
    }
  }, []);

  /** デフォルト冊を変更 (同科目の他を false に、対象を true に)。 */
  const handleSetDefaultResume = useCallback(
    (id: string, subjectId: string) => {
      setResumes((prev) =>
        prev.map((r) =>
          r.subjectId === subjectId ? { ...r, isDefault: r.id === id } : r,
        ),
      );
      if (isSupabaseConfigured()) {
        void getCurrentUserId()
          .then((ownerId) => setDefaultResume(id, subjectId, ownerId))
          .catch((err) =>
            console.error("[レジュメ冊] デフォルト変更失敗:", err),
          );
      }
    },
    [],
  );

  /**
   * 冊を削除 (★デフォルト冊は呼び出し側でガード)。中のピースをその科目のデフォルト冊へ
   * 移してから論理削除し、子の本文を失わせない。
   */
  const handleDeleteResume = useCallback(
    (id: string, subjectId: string) => {
      const defaultResume = resumes.find(
        (r) => r.subjectId === subjectId && r.isDefault && r.id !== id,
      );
      if (!defaultResume) {
        console.error("[レジュメ冊] デフォルト冊が見つからず削除中止");
        return;
      }
      // ピースをデフォルト冊へ (state)
      setNoteEntries((prev) =>
        prev.map((e) =>
          e.resumeId === id ? { ...e, resumeId: defaultResume.id } : e,
        ),
      );
      // 冊を一覧から除去 (state)
      setResumes((prev) => prev.filter((r) => r.id !== id));
      if (isSupabaseConfigured()) {
        void getCurrentUserId()
          .then((ownerId) => softDeleteResume(id, defaultResume.id, ownerId))
          .catch((err) => console.error("[レジュメ冊] 削除失敗:", err));
      }
    },
    [resumes],
  );

  /** ピースを別の冊へ振り分け (同一科目内、R5)。 */
  const handleMoveEntryToResume = useCallback(
    (entryId: string, resumeId: string) => {
      setNoteEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, resumeId } : e)),
      );
      if (isSupabaseConfigured()) {
        void moveEntryToResume(entryId, resumeId).catch((err) =>
          console.error("[レジュメ冊] 振り分け失敗:", err),
        );
      }
    },
    [],
  );

  /** 冊をコピー (Phase 3)。新しい冊 + 複製ピースを state に反映。 */
  const handleCopyResume = useCallback(
    async (sourceResumeId: string, sourceSubjectId: string, newName: string) => {
      if (isSupabaseConfigured()) {
        try {
          const ownerId = await getCurrentUserId();
          const { resume, entries } = await copyResume(
            sourceResumeId,
            sourceSubjectId,
            newName,
            ownerId,
          );
          setResumes((prev) => [...prev, resume]);
          if (entries.length > 0) {
            setNoteEntries((prev) => [...prev, ...entries]);
          }
          return;
        } catch (err) {
          console.error("[レジュメ冊] コピー失敗:", err);
          return;
        }
      }
      // mock: ローカルで冊 + ピースを複製。
      const newId = `resume-local-${Date.now()}`;
      setResumes((prev) => [
        ...prev,
        { id: newId, subjectId: sourceSubjectId, name: newName, isDefault: false },
      ]);
      setNoteEntries((prev) => [
        ...prev,
        ...prev
          .filter((e) => e.resumeId === sourceResumeId)
          .map((e, i) => ({
            ...e,
            id: `note-local-${Date.now()}-${i}`,
            resumeId: newId,
          })),
      ]);
    },
    [],
  );

  /**
   * R11-①: 冊のアウトライン (Ⅰ・1 の章立て + ピース一括配置) を AI 下書き / 言葉で修正。
   * - 新規 (instruction なし or 現アウトラインなし): 教材構造 + 全ピースから下書き
   * - 修正 (instruction あり + 現アウトラインあり): 最小限の変更。Claude 失敗時は現状維持
   * - Claude flag off / 新規での失敗: フォールバック (教材ごと 1 章・ページ順)
   * 保存は resumes.outline (migration 未適用なら in-memory のみで動線は止めない)。
   */
  const handleGenerateOutline = useCallback(
    async (resume: Resume, instruction?: string) => {
      // この冊のピース (NotesHomeView の scopedEntries と同じ規則:
      // デフォルト冊は resume_id 未設定の移行漏れも拾う)
      const bookEntries = noteEntries.filter((e) => {
        if (e.deletedAt) return false;
        if (e.subjectId !== resume.subjectId) return false;
        return e.resumeId === resume.id || (resume.isDefault && !e.resumeId);
      });
      const isRevision =
        !!instruction && !!resume.outline && resume.outline.length > 0;

      let outline: ResumeOutlineSection[] | null = null;
      if (process.env.NEXT_PUBLIC_USE_CLAUDE_API === "true") {
        try {
          const subjectName =
            subjects.find((s) => s.id === resume.subjectId)?.name ?? "教科";
          const materialStructures = materials
            .filter(
              (m) =>
                (m.kind ?? "book") === "book" &&
                m.subjectId === resume.subjectId &&
                !m.deletedAt,
            )
            .map((m) => ({
              materialName: m.name,
              segmentNames: getPlanSegments(m)
                .map((s) => s.conceptName)
                .slice(0, 60),
            }))
            .filter((m) => m.segmentNames.length > 0);
          const raw = await buildResumeOutlineViaClaude({
            subjectName,
            bookName: resume.name,
            entries: bookEntries.map((e) => ({
              id: e.id,
              conceptName: e.conceptName,
              pageRange: e.sourcePageRange,
              materialName: e.sourceMaterialId
                ? materials.find((m) => m.id === e.sourceMaterialId)?.name
                : undefined,
            })),
            materialStructures,
            currentOutline: isRevision
              ? resume.outline!.map((s) => ({
                  title: s.title,
                  entryIds: s.entryIds,
                }))
              : undefined,
            instruction: instruction || undefined,
          });
          const sanitized = sanitizeOutline(raw, bookEntries);
          if (sanitized.length > 0) outline = sanitized;
        } catch (err) {
          console.error("[レジュメ] アウトライン AI 下書き失敗:", err);
        }
      }
      if (!outline) {
        // 修正モードの失敗は現状維持 (フォールバックで作り直すと子の指示を無視した
        // 全再編になってしまう)
        if (isRevision) return;
        outline = buildFallbackOutline(
          bookEntries,
          (materialId) =>
            materials.find((m) => m.id === materialId)?.name ?? null,
        );
      }

      setResumes((prev) =>
        prev.map((r) => (r.id === resume.id ? { ...r, outline: outline! } : r)),
      );
      if (isSupabaseConfigured()) {
        try {
          await updateResumeOutline(resume.id, outline);
        } catch (err) {
          console.error(
            "[レジュメ] アウトライン保存失敗 (in-memory のみ。migration 20260611010000 適用要):",
            err,
          );
        }
      }
    },
    [noteEntries, subjects, materials],
  );

  /**
   * 科目付け間違いの修正: ピースを別の科目へ移す。移動先科目のデフォルト冊に着地させる
   * (ensureDefaultResume で確保)。subjectId + resumeId を更新、出典はそのまま。
   */
  const handleMoveEntryToSubject = useCallback(
    async (entryId: string, targetSubjectId: string) => {
      const targetName =
        subjects.find((s) => s.id === targetSubjectId)?.name ?? "教科";
      if (isSupabaseConfigured()) {
        try {
          const ownerId = await getCurrentUserId();
          const resume = await ensureDefaultResume(
            targetSubjectId,
            targetName,
            ownerId,
          );
          // 新規作成されたデフォルト冊なら resumes state に反映 (dedupe)。
          setResumes((prev) =>
            prev.some((r) => r.id === resume.id) ? prev : [...prev, resume],
          );
          await moveEntryToSubject(entryId, targetSubjectId, resume.id);
          setNoteEntries((prev) =>
            prev.map((e) =>
              e.id === entryId
                ? { ...e, subjectId: targetSubjectId, resumeId: resume.id }
                : e,
            ),
          );
          return;
        } catch (err) {
          console.error("[レジュメ] 科目修正失敗:", err);
          return;
        }
      }
      // mock: subjectId のみ更新 (冊レコードは無い)。
      setNoteEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, subjectId: targetSubjectId } : e,
        ),
      );
    },
    [subjects],
  );

  // ----- まとめノート N9② Q3: 定期振り返り = ハブで open を 1 件だけ小出し -----
  // open エントリがあれば、セッション 1 回だけゆいが「もう一回見てみる?」と提案する
  // (壁にしない・1 件だけ、N2)。「ノートを見る」quickReply で open-notes へ。
  const openNudgeRef = useRef(false);
  useEffect(() => {
    if (openNudgeRef.current) return;
    const firstOpen = noteEntries.find((e) => e.status === "open");
    if (!firstOpen) return;
    openNudgeRef.current = true;
    // open があれば 1 回だけ提案を append (定期振り返りトリガー、N9② Q3)。
    // ★重複表示バグ修正 (2026-06-11 実機報告): 同日 thread は localStorage に保存・
    // 復元されるため、リロードのたびに「復元済みナッジ + 新規ナッジ」が積み重なって
    // いた (openNudgeRef はマウント毎にリセットされる)。thread 内に既にナッジが
    // あれば append しない = 1 日 1 回に揃える。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTutorMessages((prev) =>
      prev.some((m) => m.id.startsWith("t-note-nudge-"))
        ? prev
        : [
            ...prev,
            {
              id: `t-note-nudge-${Date.now()}`,
              role: "tutor",
              text: `そういえば、前に「まだ」だった「${firstOpen.conceptName}」があるよ。\n気が向いたら、もう一回説明してみる? できそうなら理解済みにできるよ。`,
              quickReplies: ["レジュメを見る"],
              createdAt: new Date().toISOString(),
            },
          ],
    );
  }, [noteEntries]);

  // ----- 教材追加完了時: materials state に push + ゆい発話 + 新教材の詳細へ遷移 -----
  // 登録フロー本体 (DB 保存 + PDF 裏アップロード + 表紙サムネ + まとまり区切り) は
  // useMaterials が担当。ここではゆい発話と詳細遷移の UI 副作用を呼び出し時
  // コールバックで渡すだけ (C32 アップ完了動線 = 「葵が読んだよ、見る?」→ 詳細展開)。
  const handleMaterialAdded = useCallback(
    (material: Material, approvedNodeCount: number, file?: File | null) => {
      addMaterialWithUiHooks(material, approvedNodeCount, file, {
        pushTutorMessage: (message) =>
          setTutorMessages((prev) => [...prev, message]),
        onRegistered: (m) => navigate("material-detail", { materialId: m.id }),
      });
    },
    [addMaterialWithUiHooks, navigate],
  );

  // ----- C30 2026-05-25 grill 2: 科目追加完了時の処理 -----
  // SubjectSettingsPanel から呼ばれる。科目の生成・永続化は useSubjects (addSubject) が
  // 担当し、ここではゆいの完了発話 + 右ペインを閉じる UI 副作用のみ
  // (S7 主体: 親+娘さん両方が使う動線)。
  const handleSubjectAdded = useCallback(
    async (input: {
      name: string;
      teacherName: string;
      avatarLetter: string;
    }) => {
      await addSubject(input);
      const reply: TutorMessage = {
        id: `t-subj-${Date.now()}`,
        role: "tutor",
        text: `「${input.name}」追加したよ！${input.teacherName}先生がこの教科を担当するよ。\nこれで計画立案や教材登録で選べるようになったよ。`,
        createdAt: new Date().toISOString(),
      };
      setTutorMessages((prev) => [...prev, reply]);
      navigate("default");
    },
    [addSubject, navigate],
  );

  // ----- Phase B: 「おかえり、今日なにやる?」儀式 (2026-06-11 grill B-1〜B-8) -----
  //
  // 候補 = 宿題・テスト (まだ、提出日近い順、上位 5) + プラン外の本 (まとまり生成済み)。
  // 候補は Supabase 由来の workspace state から作るので、tutor-mock の state machine は
  // 通さない (intercept でゆいの state も進めない)。選んだ pick はダッシュボード
  // 「今日のタスク」下段「きょう決めたこと」に出る。

  const computeDayCandidates = useCallback(() => {
    const subjectLabelOf = (id: string) =>
      subjects.find((s) => s.id === id)?.name ?? "—";
    const activePlanMaterialIds = new Set(
      plans
        .filter((p) => p.status === "active" && !p.deletedAt)
        .map((p) => p.materialId),
    );
    const assignments = materials
      .filter(
        (m) =>
          m.kind === "assignment" &&
          (m.assignmentStatus ?? "todo") === "todo" &&
          !m.deletedAt &&
          !dayPickedKeys.has(m.id),
      )
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      })
      .slice(0, 5)
      .map((m) => ({
        materialId: m.id,
        label: m.name,
        subjectLabel: subjectLabelOf(m.subjectId),
        dueDate: m.dueDate,
        isTest: m.assignmentType === "test",
      }));
    // 本はプラン外 (自動枠と競合しない) + まとまり生成済みのみ (B-2/B-3)
    const books = materials
      .filter(
        (m) =>
          (m.kind ?? "book") === "book" &&
          !m.deletedAt &&
          !activePlanMaterialIds.has(m.id) &&
          getPlanSegments(m).length > 0,
      )
      .map((m) => ({
        materialId: m.id,
        label: m.name,
        subjectLabel: subjectLabelOf(m.subjectId),
      }));
    return { assignments, books };
  }, [materials, plans, subjects, dayPickedKeys]);

  /** 儀式の入口発話 (候補ピッカーカード付き)。Claude flag on なら text を言い換え。 */
  // ----- ゆい chat ストリーミング (レビュー Phase 2-⑤ 第 2 弾、2026-06-12) -----
  // Claude 言い換え (plan-request / scene 汎用 / day-start / day-close) を
  // /api/tutor-chat からストリーミングで受け、途中経過を TutorChat の吹き出しに流す。
  // grill 確定: 途中で切れたら出た分を残して謝る / 全失敗は mock 文維持 (動線止めない)。
  const [yuiStreamingText, setYuiStreamingText] = useState<string | null>(null);
  const streamYuiText = useCallback(
    async (req: TutorClaudeRequest, fallbackText: string): Promise<string> => {
      try {
        const { text, errored } = await streamNdjsonText(
          "/api/tutor-chat",
          req,
          (t) => setYuiStreamingText(t),
        );
        const trimmed = text.trim();
        if (!errored && trimmed.length > 0) return trimmed;
        if (errored && trimmed.length > 0)
          return `${trimmed}\n\n…ごめん、途中で止まっちゃった💦 続きはもう一回聞いてね。`;
        return fallbackText;
      } catch (err) {
        console.error("[ゆい chat] ストリーミング失敗、mock 文維持:", err);
        return fallbackText;
      } finally {
        setYuiStreamingText(null);
      }
    },
    [],
  );

  const buildDayRitualReply = useCallback(
    async (userInput: string): Promise<TutorMessage> => {
      const { assignments, books } = computeDayCandidates();
      const now = new Date().toISOString();
      // 候補 0 件でもカードは出す (「＋新しい宿題・テストを登録」が一番多いケース)
      let text =
        assignments.length === 0 && books.length === 0
          ? "今日なにやる? 登録済みで選べるものはないけど、新しく出た宿題があったらここから登録してね👇 プランのまとまりだけでも OK!"
          : "いいね、今日やること決めよう! 候補はこのへんだよ👇 やるやつをタップしてね。\n\nもちろん「今日はプランだけ」でも全然 OK だよ。";
      if (process.env.NEXT_PUBLIC_USE_CLAUDE_API === "true") {
        text = await streamYuiText(
          {
            kind: "scene",
            scene: "day-start",
            sceneContext: {
              assignmentCount: assignments.length,
              assignmentNames: assignments.map((a) => a.label),
              bookCount: books.length,
              note: "この発話の直後に候補ピッカーカードが表示される。タップで選べること、選ばなくても (プランだけでも) 良いことを短く伝える",
            },
            userInput,
            fallbackText: text,
          },
          text,
        );
      }
      return {
        id: `t-day-${Date.now()}`,
        role: "tutor",
        text,
        card: { kind: "day-picker", assignments, books },
        quickReplies: ["今日はプランだけでいい"],
        createdAt: now,
      };
    },
    [computeDayCandidates, streamYuiText],
  );

  /** 儀式の締め (「今日はプランだけ」「これで OK」)。 */
  const buildDayCloseReply = useCallback(
    async (userInput: string): Promise<TutorMessage> => {
      const pickedCount = dayPicks.filter((p) => !p.completedAt).length;
      const now = new Date().toISOString();
      let text =
        pickedCount > 0
          ? "OK! 今日の分はダッシュボードの「きょう決めたこと」に出てるよ📌 さっそく始めよう🔥"
          : "OK! 今日はプランの「つぎのまとまり」を進めよう💪 ダッシュボードから始めてね。";
      if (process.env.NEXT_PUBLIC_USE_CLAUDE_API === "true") {
        text = await streamYuiText(
          {
            kind: "scene",
            scene: "day-close",
            sceneContext: {
              pickedCount,
              note: "「今日なにやる?」儀式の締め。決めた分 (pickedCount 件) はダッシュボードに出ていることを短く伝えて送り出す",
            },
            userInput,
            fallbackText: text,
          },
          text,
        );
      }
      return {
        id: `t-dayclose-${Date.now()}`,
        role: "tutor",
        text,
        createdAt: now,
      };
    },
    [dayPicks, streamYuiText],
  );

  // 宿題・テストをタップ → pick 追加 + 「他にもやる?」(B-6)
  const onPickDayAssignment = useCallback(
    async (materialId: string, label: string): Promise<TutorMessage> => {
      const now = new Date().toISOString();
      if (dayPickedKeys.has(materialId)) {
        return {
          id: `t-daypick-${Date.now()}`,
          role: "tutor",
          text: `「${label}」はもう今日の分に入ってるよ〜👍`,
          quickReplies: ["他にもやる", "今日はこれでOK"],
          createdAt: now,
        };
      }
      await addDayPick(materialId);
      return {
        id: `t-daypick-${Date.now()}`,
        role: "tutor",
        text: `OK!「${label}」を今日のタスクに入れたよ📌 ダッシュボードの「きょう決めたこと」に出てるからね。\n\n**他にもやる?**`,
        quickReplies: ["他にもやる", "今日はこれでOK"],
        createdAt: now,
      };
    },
    [dayPickedKeys, addDayPick],
  );

  // 本をタップ → まとまりピッカー (B-3: 済み ✓ + おすすめ = 最初の未済)
  const onPickDayBook = useCallback(
    async (materialId: string, label: string): Promise<TutorMessage> => {
      const now = new Date().toISOString();
      const material = materials.find((m) => m.id === materialId);
      if (!material) {
        return {
          id: `t-dayseg-${Date.now()}`,
          role: "tutor",
          text: "あれ、その本が見つからなかった…もう一回選んでみて。",
          createdAt: now,
        };
      }
      const segs = getPlanSegments(material);
      const doneIds = new Set(
        noteEntries
          .filter(
            (n) =>
              !n.deletedAt &&
              n.status === "understood" &&
              n.sourceMaterialId === materialId &&
              n.sourceSegmentId,
          )
          .map((n) => n.sourceSegmentId as string),
      );
      const firstPending = segs.find((s) => !doneIds.has(s.id));
      return {
        id: `t-dayseg-${Date.now()}`,
        role: "tutor",
        text: `「${label}」だね! どのまとまりやる? ⭐がつぎのおすすめだよ。`,
        card: {
          kind: "day-segment-picker",
          materialId,
          materialLabel: material.name,
          options: segs.map((s) => ({
            segmentId: s.id,
            label: s.conceptName,
            pageRange: `p.${s.startPdfPage}–${s.endPdfPage}`,
            done: doneIds.has(s.id),
            recommended: firstPending?.id === s.id,
          })),
        },
        createdAt: now,
      };
    },
    [materials, noteEntries],
  );

  // まとまりをタップ → pick 追加 + 「他にもやる?」
  const onPickDaySegment = useCallback(
    async (
      materialId: string,
      segmentId: string,
      label: string,
    ): Promise<TutorMessage> => {
      const now = new Date().toISOString();
      if (dayPickedKeys.has(`${materialId}:${segmentId}`)) {
        return {
          id: `t-daypick-${Date.now()}`,
          role: "tutor",
          text: `「${label}」はもう今日の分に入ってるよ〜👍`,
          quickReplies: ["他にもやる", "今日はこれでOK"],
          createdAt: now,
        };
      }
      await addDayPick(materialId, segmentId);
      return {
        id: `t-daypick-${Date.now()}`,
        role: "tutor",
        text: `OK!「${label}」を今日のタスクに入れたよ📌 ダッシュボードの「きょう決めたこと」に出てるからね。\n\n**他にもやる?**`,
        quickReplies: ["他にもやる", "今日はこれでOK"],
        createdAt: now,
      };
    },
    [dayPickedKeys, addDayPick],
  );

  // ダッシュボード「＋ゆいと決める」ボタン → 左の chat に儀式カードを出す (B-1/B-8)。
  // 2 回目以降も同じ儀式 (候補は選択済みを除いた最新)。候補 0 件でもカードは出す
  // (「＋新しい宿題・テストを登録」が一番多いケースのため)。
  const handleStartDayRitual = useCallback(() => {
    const { assignments, books } = computeDayCandidates();
    const now = new Date().toISOString();
    const msg: TutorMessage = {
      id: `t-day-${Date.now()}`,
      role: "tutor",
      text:
        assignments.length === 0 && books.length === 0
          ? "今日なにやる? 新しく出た宿題があったら、ここから登録してね👇"
          : "今日やること決めよう! 候補はこのへんだよ👇 やるやつをタップしてね。",
      card: { kind: "day-picker", assignments, books },
      quickReplies: ["今日はプランだけでいい"],
      createdAt: now,
    };
    setTutorMessages((prev) => [...prev, msg]);
  }, [computeDayCandidates]);

  // 「＋新しい宿題・テストを登録」(Phase B 拡張、2026-06-11 ito19 さん実機フィードバック
  // 「今日のタスクで一番多いのは宿題・テスト」)。その場で AssignmentDialog を開く。
  //   "ritual" = 儀式中の登録 → 保存と同時に今日の枠へ自動 pick + ゆいが続ける
  //   "plain"  = ダッシュボード宿題・テストカードの「＋追加」→ 登録だけ
  const [dayAssignmentDialog, setDayAssignmentDialog] = useState<
    null | "ritual" | "plain"
  >(null);

  const handleDayAssignmentSubmit = useCallback(
    async (input: NewAssignmentInput, pdfFile?: File, id?: string) => {
      const mode = dayAssignmentDialog;
      const created = await handleSubmitAssignment(input, pdfFile, id);
      if (mode === "ritual" && created) {
        await addDayPick(created.id);
        setTutorMessages((prev) => [
          ...prev,
          {
            id: `t-daypick-${Date.now()}`,
            role: "tutor",
            text: `「${created.name}」を登録して、今日のタスクに入れたよ📌 ダッシュボードの「きょう決めたこと」に出てるからね。\n\n**他にもやる?**`,
            quickReplies: ["他にもやる", "今日はこれでOK"],
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    },
    [dayAssignmentDialog, handleSubmitAssignment, addDayPick],
  );

  // その日最初 (今日の thread が新規 = B-8) は、データロード後にゆいの挨拶へ続けて
  // 候補ピッカーカードを 1 回だけ append する (B-1)。候補 0 件なら出さない =
  // 通常挨拶フォールバック。少しタメる (人間味 + setState-in-effect 回避)。
  const dayCardAppendedRef = useRef(false);
  useEffect(() => {
    if (!tutorInit.freshToday) return;
    if (!materialsLoaded || !plansLoaded || !dayPicksLoaded) return;
    if (dayCardAppendedRef.current) return;
    const timer = window.setTimeout(() => {
      if (dayCardAppendedRef.current) return;
      dayCardAppendedRef.current = true;
      const { assignments, books } = computeDayCandidates();
      if (assignments.length === 0 && books.length === 0) return;
      setTutorMessages((prev) => {
        if (prev.some((m) => m.card?.kind === "day-picker")) return prev;
        return [
          ...prev,
          {
            id: `t-day-${Date.now()}`,
            role: "tutor",
            topic: "morning-reflection",
            text: "今日の候補はこのへんだよ👇 やるやつあったらタップしてね。",
            card: { kind: "day-picker", assignments, books },
            quickReplies: ["今日はプランだけでいい"],
            createdAt: new Date().toISOString(),
          },
        ];
      });
    }, 900);
    return () => window.clearTimeout(timer);
    // computeDayCandidates はタイマー発火時点の最新を使いたいだけなので deps に入れない
    // (loaded フラグ 3 つが揃った 1 回だけ発火させる)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorInit.freshToday, materialsLoaded, plansLoaded, dayPicksLoaded]);

  // ----- ゆい chat: 返信生成（mock + rightPaneAction 適用） -----
  // Phase 6 smoke test: buildNextTutorReplyAsync 経由で「計画立てよう」入口だけ Claude Opus 4.8 化。
  // フラグ off / それ以外 keyword は内部で同期 buildNextTutorReply に委譲、Claude 失敗時も mock fallback。
  const generateReply = useCallback(
    async ({ userInput }: { userInput: string; history: TutorMessage[] }): Promise<TutorMessage> => {
      // Phase B: 「今日なにやる?」儀式はゆいの state machine を通さない intercept。
      // 候補が workspace の実データ (Supabase 由来) からしか作れないため tutor-mock では
      // 扱えない。state も進めない (儀式の前後で会話の文脈を壊さない)。
      const t = userInput.trim();
      if (
        t.includes("今日やること") ||
        t.includes("今日なにやる") ||
        t.includes("今日何やる") ||
        t.includes("他にもやる")
      ) {
        return buildDayRitualReply(userInput);
      }
      if (
        t.includes("今日はプランだけ") ||
        t.includes("今日はこれでOK") ||
        t.includes("今日はこれで OK")
      ) {
        return buildDayCloseReply(userInput);
      }
      // ストリーミング化 (第 2 弾): mock が reply 構造 (card / state 遷移) を同期で組み立て、
      // Claude 対象シーンなら text だけを /api/tutor-chat からストリーミングで受ける。
      const { result, claude } = prepareTutorReply({
        state: tutorStepRef.current,
        userInput,
      });
      if (claude) {
        result.reply.text = await streamYuiText(
          claude,
          result.reply.text ?? "",
        );
      }
      tutorStepRef.current = result.nextState;
      if (result.reply.rightPaneAction) {
        applyRightPaneAction(result.reply.rightPaneAction);
      }
      return result.reply;
    },
    [applyRightPaneAction, buildDayRitualReply, buildDayCloseReply, streamYuiText],
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

  // ----- Issue 操作 → useIssues に抽出済 (Phase 3 モノリス分割、2026-06-12) -----

  // 右ペインに課題 chat が出ている時、左ゆい入力欄を無効化する
  // （subject-history 等の他 view では左ゆいは常時アクティブ）
  const tutorLocked = view === "issue";

  // 段階1-C: 読書ビュー (material-read) はゆい左ペインを隠してフル幅で表示する集中モード
  const readMaterial =
    view === "material-read" && selectedMaterialId
      ? (materials.find((m) => m.id === selectedMaterialId) ?? null)
      : null;

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
        {/* ★2026-06-08: 旧「学習画面へ」(/learn) ボタンは廃止 (学習は教材の「一緒に読む」へ集約) */}
      </header>

      {view === "material-read" ? (
        // 段階1-C: 読書ビューはゆい左ペインを隠してフル幅の集中モードで表示
        readMaterial ? (
          <MaterialReadPane
            material={readMaterial}
            subject={
              subjects.find((s) => s.id === readMaterial.subjectId) ?? null
            }
            initialPage={readInitialPage}
            selectUnitOnLoad={readSelectUnit}
            onCoverThumb={handleCoverThumb}
            onBack={() =>
              readMaterial.kind === "assignment"
                ? // 宿題は教材詳細を持たない → 宿題・テスト一覧タブへ戻る
                  navigate("materials", { tab: "assignments" })
                : navigate("material-detail", { materialId: readMaterial.id })
            }
            onOpenResume={() =>
              navigate("notes", { subjectId: readMaterial.subjectId })
            }
            resumes={resumes}
            onAddResume={handleAddResume}
            onNoteAdded={handleNoteAdded}
            onLogRead={(segmentId, conceptName) =>
              addLearningLog({
                kind: "read",
                subjectId: readMaterial.subjectId,
                materialId: readMaterial.id,
                segmentId,
                title: conceptName,
              })
            }
            onStudyMinute={() =>
              handleStudyMinute(readMaterial.id, readMaterial.subjectId)
            }
            onAssignmentIssues={(found) =>
              handleAssignmentIssues(readMaterial.name, found)
            }
            onAssignmentDone={() =>
              handleToggleAssignmentStatus(readMaterial.id, "done")
            }
            onGuidedPlansSaved={handleGuidedPlansSaved}
            notedSegmentIds={
              // ★ segment id は教材内ユニーク (seg-1 等) なので、必ず教材で絞る。
              //   絞らないと別教材の同名 seg がこの教材の緑チェックに誤マッチする。
              new Set(
                noteEntries
                  .filter(
                    (e) =>
                      e.sourceSegmentId &&
                      e.sourceMaterialId === readMaterial.id,
                  )
                  .map((e) => e.sourceSegmentId as string),
              )
            }
            noteEntries={noteEntries}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
            <span>教材が見つかりませんでした。</span>
            <Button variant="outline" size="sm" onClick={() => navigate("materials")}>
              教材一覧へ
            </Button>
          </div>
        )
      ) : (
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
            streamingText={yuiStreamingText}
            nodes={nodes}
            issues={issues}
            scheduleItems={scheduleToday}
            generateReply={generateReply}
            onPickSubject={onPickSubject}
            onPickMaterial={onPickMaterial}
            onPickDuration={onPickDuration}
            onPickWeakNodes={onPickWeakNodes}
            dayPickedKeys={dayPickedKeys}
            onPickDayAssignment={onPickDayAssignment}
            onPickDayBook={onPickDayBook}
            onPickDaySegment={onPickDaySegment}
            onAddDayAssignment={() => setDayAssignmentDialog("ritual")}
            externallyLocked={tutorLocked}
            externalLockMessage={
              tutorLocked
                ? "課題の対話中… 右で科目の先生と話してね"
                : undefined
            }
            onSelectIssue={(id) => navigate("issue", { issueId: id })}
            onSeeAllIssues={() => navigate("issues")}
            onSelectIssueItem={(id) => navigate("issue", { issueId: id })}
            onSeeAllSchedule={() => navigate("default")}
            onOpenDashboard={() => navigate("default")}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右: 動的展開エリア */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <RightPaneRouter
            view={view}
            selectedSubjectId={selectedSubjectId}
            selectedMaterialId={selectedMaterialId}
            nodes={nodes}
            scheduleToday={scheduleToday}
            subjects={subjects}
            learningLogs={learningLogs}
            studyMinutes={studyMinutes}
            onBack={() => navigate("default")}
            onSubjectAdded={handleSubjectAdded}
            onNavigate={navigate}
            calendar={calendarApi}
            issuesApi={{
              issues,
              selectedIssue,
              chatMessages,
              onResolve: handleResolveIssue,
              onReopen: handleReopenIssue,
              onAppendChatMessages: handleAppendChatMessages,
              onSelect: (id) => navigate("issue", { issueId: id }),
            }}
            materialsApi={{
              materials,
              loadState: materialsLoadState,
              onAdded: handleMaterialAdded,
              onUpdated: handleMaterialUpdated,
              onDeleted: handleMaterialDeleted,
              onResegment: resegmentMaterial,
            }}
            assignmentsApi={{
              onSubmit: handleSubmitAssignment,
              onDelete: handleDeleteAssignment,
              onToggleStatus: handleToggleAssignmentStatus,
              onStudy: (materialId) =>
                navigate("material-read", { materialId }),
              onAddQuick: () => setDayAssignmentDialog("plain"),
            }}
            plansApi={{
              plans,
              onCreate: handleCreatePlan,
              onExtend: handleExtendPlan,
              onComplete: handleCompletePlan,
              onRestart: handleRestartPlan,
              onToggleSkip: handleTogglePlanSkip,
              onDelete: handleDeletePlan,
            }}
            resumesApi={{
              noteEntries,
              resumes,
              onNoteUpdated: handleNoteUpdated,
              onNoteDeleted: handleNoteDeleted,
              onOpenSource: (materialId, page) =>
                navigate("material-read", { materialId, page }),
              onAddResume: handleAddResume,
              onRenameResume: handleRenameResume,
              onSetDefaultResume: handleSetDefaultResume,
              onDeleteResume: handleDeleteResume,
              onMoveEntryToResume: handleMoveEntryToResume,
              onMoveEntryToSubject: handleMoveEntryToSubject,
              onCopyResume: handleCopyResume,
              onGenerateOutline: handleGenerateOutline,
            }}
            dayApi={{
              dayPicks,
              onRemove: handleRemoveDayPick,
              onStartRitual: handleStartDayRitual,
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      )}

      {/* Phase B 拡張: 宿題・テストのその場登録 (儀式カード / ダッシュボード「＋追加」から)。
          ritual モードは保存と同時に今日の枠へ自動 pick + ゆいが続ける。 */}
      <AssignmentDialog
        open={dayAssignmentDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDayAssignmentDialog(null);
        }}
        subjects={subjects}
        assignment={null}
        onSubmit={handleDayAssignmentSubmit}
        onDelete={() => {}}
      />
    </div>
  );
}
