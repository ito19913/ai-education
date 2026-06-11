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
import { MaterialReadPane } from "@/components/materials/MaterialReadPane";
import { setSessionPdf } from "@/lib/admin/session-pdf-store";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import {
  fetchMaterials,
  insertMaterial,
  updateMaterialPdfPath,
  updateMaterialSegments,
  updateMaterialMeta,
  updateMaterialCoverThumb,
  softDeleteMaterial,
  insertAssignment,
  updateAssignment,
  updateAssignmentStatus,
  getCurrentUserId,
  type NewAssignmentInput,
} from "@/lib/materials/materials-repo";
import {
  extractFullPageTexts,
  loadPdfDocument,
  renderCoverThumb,
} from "@/lib/admin/pdf-extract-text";
import { segmentConceptsFromText } from "@/lib/admin/segment-claude";
import { buildScanSegments } from "@/lib/admin/scan-segment-builder";
import {
  uploadMaterialPdf,
  removeMaterialPdf,
} from "@/lib/materials/pdf-storage";
import {
  fetchNoteEntries,
  updateNoteEntry,
  softDeleteNoteEntry,
} from "@/lib/notes/notes-repo";
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
} from "@/lib/notes/resumes-repo";
import {
  fetchCustomSubjects,
  insertSubject,
} from "@/lib/subjects/subjects-repo";
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
import {
  fetchPlans,
  insertPlan,
  updatePlanEndsAt,
  updatePlanStatus,
  updatePlanSkips,
  softDeletePlan,
} from "@/lib/plans/plans-repo";
import {
  fetchLearningLogs,
  insertLearningLog,
  fetchStudyMinutes,
  incrementStudyMinute,
  type NewLearningLogInput,
} from "@/lib/history/learning-logs-repo";
import { DEFAULT_EVENT_LABELS } from "@/lib/learn/event-colors";
import {
  buildInitialTutorThread,
  buildNextTutorReply,
  buildNextTutorReplyAsync,
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
import { MOCK_MATERIALS, MOCK_SUBJECTS } from "@/lib/learn/mock-data";
import type {
  AssignmentStatus,
  CalendarEvent,
  ChatMessage,
  ConceptSegment,
  EventLabel,
  EventLabelColor,
  ExamPrep,
  Homework,
  Issue,
  IssueChatMessage,
  KnowledgeNode,
  LearningLog,
  LearningSession,
  StudyMinutesBucket,
  LessonReview,
  Material,
  NoteEntry,
  Resume,
  RightPaneView,
  ScheduleItem,
  StudyPlan,
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
  // C30 2026-05-25 grill 2 S7: 科目追加対応で subjects を useState 化
  // SubjectSettingsPanel から動的 push される
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);

  // 2026-06-07 科目永続化: real モードでは起動時に DB からカスタム科目を取得し、
  // ハードコード5教科 (initialSubjects) にマージする。id で dedupe (同一セッション中に
  // 追加→DB fetch が二重にならないように)。これで手動追加した科目がリロード後も残る。
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchCustomSubjects()
      .then((rows) => {
        if (cancelled) return;
        setSubjects((prev) => {
          const ids = new Set(prev.map((s) => s.id));
          const additions = rows.filter((s) => !ids.has(s.id));
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });
      })
      .catch((err) => console.error("[科目] 一覧取得失敗:", err));
    return () => {
      cancelled = true;
    };
  }, []);
  // C46 2026-05-26 F (ito19 さん意見): 教材編集・削除のため materials を state 管理。
  // 段階1-B (2026-06-05): real モード (Supabase 設定済) は起動時 DB fetch で復元、
  // mock モードは MOCK_MATERIALS をフォールバック表示 (リロードで消える割り切り)。
  // RightPaneRouter 経由で MaterialsListPane / MaterialDetailView に最新 state を流す。
  const [materials, setMaterials] = useState<Material[]>(
    isSupabaseConfigured() ? [] : MOCK_MATERIALS,
  );

  // 段階1-B: real モードでは起動時に DB から教材一覧を取得して復元する。
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchMaterials()
      .then((rows) => {
        if (!cancelled) setMaterials(rows);
      })
      .catch((err) => console.error("[教材] 一覧取得失敗:", err));
    return () => {
      cancelled = true;
    };
  }, []);

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
  // real は DB から。mock は in-memory (リロードで消える)。
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchPlans()
      .then((rows) => {
        if (!cancelled) setPlans(rows);
      })
      .catch((err) => console.error("[プラン] 一覧取得失敗:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  /** 「プランに組み込む」。countFrom 指定は 2 周目 (最初からやり直す) 用。 */
  const handleCreatePlan = useCallback(
    async (material: Material, endsAt: string, countFrom?: string) => {
      const input = {
        subjectId: material.subjectId,
        materialId: material.id,
        endsAt,
        countFrom,
      };
      if (isSupabaseConfigured()) {
        try {
          const ownerId = await getCurrentUserId();
          const created = await insertPlan(input, ownerId);
          setPlans((prev) => [...prev, created]);
          return;
        } catch (err) {
          console.error("[プラン] 作成失敗、in-memory にフォールバック:", err);
        }
      }
      setPlans((prev) => [
        ...prev,
        {
          id: `plan-local-${Date.now()}`,
          subjectId: material.subjectId,
          materialId: material.id,
          endsAt,
          status: "active",
          skippedSegmentIds: [],
          countFrom,
        },
      ]);
    },
    [],
  );

  const handleExtendPlan = useCallback((id: string, endsAt: string) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, endsAt } : p)));
    if (isSupabaseConfigured()) {
      void updatePlanEndsAt(id, endsAt).catch((err) =>
        console.error("[プラン] 延長失敗:", err),
      );
    }
  }, []);

  const handleCompletePlan = useCallback((id: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "completed" } : p)),
    );
    if (isSupabaseConfigured()) {
      void updatePlanStatus(id, "completed").catch((err) =>
        console.error("[プラン] 終了失敗:", err),
      );
    }
  }, []);

  /** 最初からやり直す (2周目): 旧プランを completed にし、countFrom=now の新プランを作る。 */
  const handleRestartPlan = useCallback(
    (plan: StudyPlan, endsAt: string) => {
      handleCompletePlan(plan.id);
      const material = materials.find((m) => m.id === plan.materialId);
      if (material) {
        void handleCreatePlan(material, endsAt, new Date().toISOString());
      }
    },
    [handleCompletePlan, handleCreatePlan, materials],
  );

  const handleTogglePlanSkip = useCallback(
    (planId: string, segmentId: string) => {
      setPlans((prev) =>
        prev.map((p) => {
          if (p.id !== planId) return p;
          const has = p.skippedSegmentIds.includes(segmentId);
          const next = has
            ? p.skippedSegmentIds.filter((s) => s !== segmentId)
            : [...p.skippedSegmentIds, segmentId];
          if (isSupabaseConfigured()) {
            void updatePlanSkips(planId, next).catch((err) =>
              console.error("[プラン] スキップ更新失敗:", err),
            );
          }
          return { ...p, skippedSegmentIds: next };
        }),
      );
    },
    [],
  );

  const handleDeletePlan = useCallback((id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    if (isSupabaseConfigured()) {
      void softDeletePlan(id).catch((err) =>
        console.error("[プラン] 削除失敗:", err),
      );
    }
  }, []);

  // ----- 学習履歴 (出来事ログ + 学習時間、2026-06-10 grill 確定) -----
  // 履歴は「自動・必須」。実アクションへのフックから記録される (タスク任意とは独立)。
  const [learningLogs, setLearningLogs] = useState<LearningLog[]>([]);
  const [studyMinutes, setStudyMinutes] = useState<StudyMinutesBucket[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchLearningLogs()
      .then((rows) => {
        if (!cancelled) setLearningLogs(rows);
      })
      .catch((err) => console.error("[履歴] ログ取得失敗:", err));
    fetchStudyMinutes()
      .then((rows) => {
        if (!cancelled) setStudyMinutes(rows);
      })
      .catch((err) => console.error("[履歴] 学習時間取得失敗:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  /** 出来事を 1 件記録 (楽観更新 + 裏で DB)。"read" は同まとまり 1 日 1 回に丸める。 */
  const addLearningLog = useCallback(
    (input: NewLearningLogInput) => {
      if (input.kind === "read" && input.segmentId) {
        const todayKey = formatLocalDate(new Date());
        const dup = learningLogs.some(
          (l) =>
            l.kind === "read" &&
            l.segmentId === input.segmentId &&
            l.materialId === input.materialId &&
            formatLocalDate(new Date(l.createdAt)) === todayKey,
        );
        if (dup) return;
      }
      const local: LearningLog = {
        id: `log-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: input.kind,
        subjectId: input.subjectId,
        materialId: input.materialId,
        segmentId: input.segmentId,
        title: input.title,
        createdAt: new Date().toISOString(),
      };
      setLearningLogs((prev) => [local, ...prev]);
      if (isSupabaseConfigured()) {
        void (async () => {
          try {
            const ownerId = await getCurrentUserId();
            const created = await insertLearningLog(input, ownerId);
            setLearningLogs((prev) =>
              prev.map((l) => (l.id === local.id ? created : l)),
            );
          } catch (err) {
            console.error("[履歴] 記録失敗:", err);
          }
        })();
      }
    },
    [learningLogs],
  );

  /** 読書ビューのアクティブ 1 分ごとのハートビート (+1 分)。 */
  const handleStudyMinute = useCallback(
    (materialId: string, subjectId: string) => {
      const day = formatLocalDate(new Date());
      // 楽観更新 (バケットが無ければ作る)
      setStudyMinutes((prev) => {
        const idx = prev.findIndex(
          (b) => b.day === day && b.materialId === materialId,
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], minutes: next[idx].minutes + 1 };
          return next;
        }
        return [
          {
            id: `sm-local-${Date.now()}`,
            day,
            subjectId,
            materialId,
            minutes: 1,
          },
          ...prev,
        ];
      });
      if (isSupabaseConfigured()) {
        void (async () => {
          try {
            const ownerId = await getCurrentUserId();
            const bucket = await incrementStudyMinute(
              day,
              subjectId,
              materialId,
              ownerId,
            );
            // DB の真値で同期 (local 仮 id の行を置換)
            setStudyMinutes((prev) => {
              const others = prev.filter(
                (b) => !(b.day === day && b.materialId === materialId),
              );
              return [bucket, ...others];
            });
          } catch (err) {
            console.error("[履歴] 学習時間加算失敗:", err);
          }
        })();
      }
    },
    [],
  );

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
    // D5 (2026-05-27 確定): 中学生向け朝振り返り廃止。MORNING_MODE_ENABLED=false の
    // 時は morning モードのハブ挨拶のみ + state を reflection-plan (振り返り完了相当 =
    // 通常 chat 受付状態) で起動 = 5 セクション質問に巻き込まれずに本人がメニュー操作できる
    return {
      messages: buildInitialTutorThread(new Date(), "morning").messages,
      state: (MORNING_MODE_ENABLED
        ? "reflection-yesterday"
        : "reflection-plan") as TutorStep["state"],
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

  // ----- 教材編集 (C46 F、ito19 さん意見): メタ情報 patch を materials state に反映 -----
  const handleMaterialUpdated = useCallback(
    (id: string, patch: Partial<Material>) => {
      setMaterials((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
      // real モード: メタ編集 (名前/出版社/著者/種別/学年/科目) を DB に永続化。
      // これまで in-memory のみでリロードすると編集が消えていた (潜在バグ) のを是正。
      if (isSupabaseConfigured()) {
        void updateMaterialMeta(id, {
          name: patch.name,
          subjectId: patch.subjectId,
          label: patch.label,
          publisher: patch.publisher,
          author: patch.author,
          gradeLevel: patch.gradeLevel,
        }).catch((err) =>
          console.error("[教材] メタ編集の永続化に失敗:", err),
        );
      }
    },
    [],
  );

  // ----- 表紙サムネ (2026-06-08): PDF を読んだ時に生成された data URL を反映 + 永続化 -----
  // 登録時 / 読書ビューを開いた時に 1 回だけ生成し、materials state + DB に保存する。
  const handleCoverThumb = useCallback((id: string, dataUrl: string) => {
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === id && !m.coverThumb ? { ...m, coverThumb: dataUrl } : m,
      ),
    );
    if (isSupabaseConfigured()) {
      void updateMaterialCoverThumb(id, dataUrl).catch((err) =>
        console.error("[教材] 表紙サムネの永続化に失敗:", err),
      );
    }
  }, []);

  // ----- 教材削除 (C46 F、ito19 さん意見): in-memory 削除 + ゆい発話 + 一覧に戻す -----
  const handleMaterialDeleted = useCallback(
    (id: string) => {
      const deleted = materials.find((m) => m.id === id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      // 段階1-B real モード: 行は論理削除で残し、PDF 実体は Storage から消す (コスト優先)。
      if (isSupabaseConfigured()) {
        void softDeleteMaterial(id).catch((err) =>
          console.error("[教材] 論理削除失敗:", err),
        );
        if (deleted?.pdfPath) {
          void removeMaterialPdf(deleted.pdfPath).catch((err) =>
            console.error("[教材] PDF 実体削除失敗:", err),
          );
        }
      }
      const reply: TutorMessage = {
        id: `t-mat-del-${Date.now()}`,
        role: "tutor",
        text: `「${deleted?.name ?? id}」を削除したよ。\n（関連する学習計画やスケジュールへの整合は今後対応予定。）`,
        createdAt: new Date().toISOString(),
      };
      setTutorMessages((prev) => [...prev, reply]);
      navigate("materials");
    },
    [materials, navigate],
  );

  // ----- 宿題・テスト (kind="assignment"、2026-06-09) -----
  // 問題 PDF を Storage にアップして紐付ける共通処理 (新規/差し替え両用)。
  const uploadAssignmentPdf = useCallback(
    async (id: string, ownerId: string, pdfFile: File) => {
      try {
        const { path, size } = await uploadMaterialPdf(ownerId, id, pdfFile);
        await updateMaterialPdfPath(id, path, size);
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, pdfPath: path, pdfSize: size } : m,
          ),
        );
      } catch (e) {
        console.error("[宿題・テスト] PDF アップロード失敗:", e);
      }
    },
    [],
  );

  // 追加 or 編集 (id があれば編集)。PDF があれば一緒にアップ/差し替え。
  const handleSubmitAssignment = useCallback(
    async (input: NewAssignmentInput, pdfFile?: File, id?: string) => {
      // ----- 編集 -----
      if (id) {
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  name: input.name,
                  subjectId: input.subjectId,
                  assignmentType: input.assignmentType,
                  dueDate: input.dueDate,
                }
              : m,
          ),
        );
        if (isSupabaseConfigured()) {
          try {
            await updateAssignment(id, input);
          } catch (err) {
            console.error("[宿題・テスト] 更新失敗:", err);
          }
          if (pdfFile) {
            const ownerId = await getCurrentUserId();
            await uploadAssignmentPdf(id, ownerId, pdfFile);
          }
        }
        return;
      }
      // ----- 新規 -----
      if (isSupabaseConfigured()) {
        try {
          const ownerId = await getCurrentUserId();
          const created = await insertAssignment(input, ownerId);
          setMaterials((prev) => [...prev, created]);
          // assignment なので まとまり/体系図 等の重い処理はしない。
          if (pdfFile) {
            await uploadAssignmentPdf(created.id, ownerId, pdfFile);
          }
          return;
        } catch (err) {
          console.error("[宿題・テスト] 追加失敗、in-memory にフォールバック:", err);
        }
      }
      const local: Material = {
        id: `assignment-local-${Date.now()}`,
        subjectId: input.subjectId,
        name: input.name,
        label: "テキスト",
        coveredNodeIds: [],
        kind: "assignment",
        assignmentType: input.assignmentType,
        dueDate: input.dueDate,
        assignmentStatus: "todo",
      };
      setMaterials((prev) => [...prev, local]);
    },
    [uploadAssignmentPdf],
  );

  const handleDeleteAssignment = useCallback(
    (id: string) => {
      const target = materials.find((m) => m.id === id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      if (isSupabaseConfigured()) {
        void softDeleteMaterial(id).catch((err) =>
          console.error("[宿題・テスト] 削除失敗:", err),
        );
        if (target?.pdfPath) {
          void removeMaterialPdf(target.pdfPath).catch((err) =>
            console.error("[宿題・テスト] PDF 実体削除失敗:", err),
          );
        }
      }
    },
    [materials],
  );

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
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, assignmentStatus: status } : m,
        ),
      );
      if (isSupabaseConfigured()) {
        void updateAssignmentStatus(id, status).catch((err) =>
          console.error("[宿題・テスト] 状態更新失敗:", err),
        );
      }
    },
    [materials, addLearningLog],
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
      // upsert: 2 周目の深化更新 (同じ id) は置換、新規は追加 (G-C で重複を防ぐ)。
      setNoteEntries((prev) =>
        prev.some((e) => e.id === entry.id)
          ? prev.map((e) => (e.id === entry.id ? entry : e))
          : [...prev, entry],
      );
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
    [addLearningLog],
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
      }
      setNoteEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      );
      if (isSupabaseConfigured()) {
        void updateNoteEntry(id, patch).catch((err) =>
          console.error("[ノート] 更新失敗:", err),
        );
      }
    },
    [noteEntries, addLearningLog],
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTutorMessages((prev) => [
      ...prev,
      {
        id: `t-note-nudge-${Date.now()}`,
        role: "tutor",
        text: `そういえば、前に「まだ」だった「${firstOpen.conceptName}」があるよ。\n気が向いたら、もう一回説明してみる? できそうなら理解済みにできるよ。`,
        quickReplies: ["レジュメを見る"],
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [noteEntries]);

  // ----- 教材追加完了時: materials state に push + ゆい発話 + 新教材の詳細へ遷移 -----
  // C32 2026-05-25 grill 1 確定 13: アップ完了動線 = ゆいから「葵が読んだよ、見る?」
  // → 右ペインに material-detail (体系図 + 評価コメント + 葵 chat) 即時展開
  // 2026-06-04 (残課題② 解消): Step4Save が構築した Material を in-memory で materials に追加。
  // これで一覧 (MaterialsListPane) にも詳細にも登録した教材が出る。Phase 7 で永続化に置換。
  const handleMaterialAdded = useCallback(
    (material: Material, approvedNodeCount: number, file?: File | null) => {
      // まとまり (一単元=1概念) 区切り (M1-M10、2026-06-06 / C-8 スキャン本対応)。
      // 登録後バックグラウンドで全書を読み、概念単位に区切る:
      //   - デジタル PDF (文字レイヤーあり) → 本文テキストで区切る (segmentConceptsFromText)
      //   - スキャン PDF (文字レイヤー無し)   → C-8 経路 (buildScanSegments、目次土台 + vision)
      // 結果は materials state に反映 (+ real モードは DB 保存) + ゆいが「区切れたよ」と通知。
      // これで「開いた時に待つ」のではなく「アップロード時に裏で作っておく」状態になる。
      const runSegmentation = (m: Material, persist: boolean) => {
        if (!file) return;
        const subjectName =
          subjects.find((s) => s.id === m.subjectId)?.name ?? "教科";
        void (async () => {
          try {
            const { hasTextLayer, packedText } = await extractFullPageTexts(file);
            let segments: ConceptSegment[];
            if (hasTextLayer && packedText.length > 0) {
              // デジタル PDF: 本文テキストから PDF 紙番号で直接区切る (M3)。
              segments = await segmentConceptsFromText({
                materialName: m.name,
                subjectName,
                gradeLevel: m.gradeLevel ?? "中2",
                packedText,
              });
            } else {
              // スキャン PDF: C-8 ハイブリッド (目次土台 + オフセット較正) or 全ページ vision。
              // buildScanSegments は PDFDocumentProxy が要るので一時的にロードして使う。
              const loadedPdf = await loadPdfDocument(file);
              try {
                segments = await buildScanSegments(loadedPdf.doc, m, subjectName);
              } finally {
                void loadedPdf.destroy();
              }
            }
            if (segments.length === 0) return;
            setMaterials((prev) =>
              prev.map((x) =>
                x.id === m.id ? { ...x, conceptSegments: segments } : x,
              ),
            );
            if (persist) {
              try {
                await updateMaterialSegments(m.id, segments);
              } catch (err) {
                console.error("[まとまり] セグメント保存失敗:", err);
              }
            }
            setTutorMessages((prev) => [
              ...prev,
              {
                id: `t-mat-seg-${Date.now()}`,
                role: "tutor",
                text: `「${m.name}」を ${segments.length} 個のまとまり (一単元) に区切ったよ✂️\n「一緒に読む」を開くと、葵先生が「今日はここからここまで」と単元ごとに案内してくれるよ。`,
                createdAt: new Date().toISOString(),
              },
            ]);
          } catch (err) {
            console.error("[まとまり] 区切り失敗 (動線は止めない):", err);
          }
        })();
      };

      // 表紙サムネ (2026-06-08): 登録時に PDF 1 ページ目を小さく描画して一覧用に保存。
      // 重い区切り処理とは独立した軽い 1 ページ描画。失敗しても動線は止めない。
      const genCoverThumb = (m: Material, persist: boolean) => {
        if (!file) return;
        void (async () => {
          try {
            const loadedPdf = await loadPdfDocument(file);
            try {
              const thumb = await renderCoverThumb(loadedPdf.doc);
              if (thumb) {
                // mock では state 反映のみ、real では DB 保存も (handleCoverThumb 内で分岐)。
                if (persist) handleCoverThumb(m.id, thumb);
                else
                  setMaterials((prev) =>
                    prev.map((x) =>
                      x.id === m.id && !x.coverThumb
                        ? { ...x, coverThumb: thumb }
                        : x,
                    ),
                  );
              }
            } finally {
              void loadedPdf.destroy();
            }
          } catch (err) {
            console.error("[教材] 表紙サムネ生成失敗 (動線は止めない):", err);
          }
        })();
      };

      // 一覧/詳細/体系図への反映 + ゆいの「葵が読んだよ」発話 + 詳細へ遷移 (共通)。
      const announceAndShow = (m: Material) => {
        setMaterials((prev) => [...prev, m]);
        // 段階1-C/1-B: 読書ビューが任意ページを即描画できるよう PDF を L1 キャッシュ。
        if (file) setSessionPdf(m.id, file);
        const reply: TutorMessage = {
          id: `t-mat-${Date.now()}`,
          role: "tutor",
          text: `「${m.name}」、葵先生が読んだよ！\n体系図 (${approvedNodeCount} ノード) と評価コメントをまとめてくれたから、右で見せるね。`,
          createdAt: new Date().toISOString(),
        };
        setTutorMessages((prev) => [...prev, reply]);
        navigate("material-detail", { materialId: m.id });
      };

      // mock モード: 従来通り in-memory push のみ (リロードで消える)。
      if (!isSupabaseConfigured()) {
        announceAndShow(material);
        runSegmentation(material, false);
        genCoverThumb(material, false);
        return;
      }

      // 段階1-B real モード: 行は即作成 (一覧/体系図は即表示)、PDF は裏でアップロード。
      void (async () => {
        try {
          const ownerId = await getCurrentUserId();
          const saved = await insertMaterial(
            {
              subjectId: material.subjectId,
              name: material.name,
              label: material.label,
              publisher: material.publisher,
              author: material.author,
              gradeLevel: material.gradeLevel,
              coveredNodeIds: material.coveredNodeIds,
              extractedNodes: material.extractedNodes,
            },
            ownerId,
          );
          announceAndShow(saved);
          // まとまり区切りを裏で実行 (DB 保存あり)。PDF アップロードと並走してよい。
          runSegmentation(saved, true);
          // 表紙サムネを裏で生成 + DB 保存 (一覧で即表示できるように)。
          genCoverThumb(saved, true);

          // PDF を裏でアップロード (await しない)。完了で pdf_path を記録 + 完了通知。
          if (file) {
            uploadMaterialPdf(ownerId, saved.id, file)
              .then(async ({ path, size }) => {
                await updateMaterialPdfPath(saved.id, path, size);
                setMaterials((prev) =>
                  prev.map((m) =>
                    m.id === saved.id
                      ? { ...m, pdfPath: path, pdfSize: size }
                      : m,
                  ),
                );
                setTutorMessages((prev) => [
                  ...prev,
                  {
                    id: `t-mat-up-${Date.now()}`,
                    role: "tutor",
                    text: `「${saved.name}」の PDF も保存できたよ📚\nこれで次に開いた時も、リロードしても一緒に読めるよ。`,
                    createdAt: new Date().toISOString(),
                  },
                ]);
              })
              .catch((err) => {
                console.error("[教材] PDF アップロード失敗:", err);
                setTutorMessages((prev) => [
                  ...prev,
                  {
                    id: `t-mat-uperr-${Date.now()}`,
                    role: "tutor",
                    text: `ごめん、「${saved.name}」の PDF 保存が途中で止まっちゃった💦\n教材は登録できてるよ。今のセッション中は読めるけど、リロード後にもう一度開けない時は登録し直してね。`,
                    createdAt: new Date().toISOString(),
                  },
                ]);
              });
          }
        } catch (err) {
          console.error("[教材] 保存失敗、in-memory にフォールバック:", err);
          // DB 保存に失敗してもUXを止めない: in-memory で見せる (リロードで消える)。
          announceAndShow(material);
          runSegmentation(material, false);
        }
      })();
    },
    [navigate, subjects, handleCoverThumb],
  );

  // ----- C30 2026-05-25 grill 2: 科目追加完了時の処理 -----
  // SubjectSettingsPanel から呼ばれる。新規 Subject を生成して subjects state に追加、
  // ゆいに完了発話を追加して右ペインを閉じる (S7 主体: 親+娘さん両方が使う動線)。
  // MOCK_SUBJECTS にも push して他画面 (admin 等) でも見えるようにする (in-memory mock)。
  // 2026-06-07 科目永続化: real モードでは DB に insert して DB 採番 id で state に追加。
  // これで科目とその科目に紐づけた教材がリロード後も残る (旧来は in-memory のみで消えていた)。
  // mock モード or DB 失敗時は in-memory id でフォールバック (リロードで消える割り切り)。
  const handleSubjectAdded = useCallback(
    async (input: {
      name: string;
      teacherName: string;
      avatarLetter: string;
    }) => {
      const buildLocal = (id: string): Subject => ({
        id,
        name: input.name,
        teacher: {
          name: input.teacherName,
          displayName: `${input.teacherName}先生`,
          avatarLetter: input.avatarLetter,
          subtitle: `${input.name}の先生`,
        },
      });

      let newSubject: Subject;
      if (isSupabaseConfigured()) {
        try {
          const ownerId = await getCurrentUserId();
          newSubject = await insertSubject(
            {
              name: input.name,
              teacherName: input.teacherName,
              avatarLetter: input.avatarLetter,
            },
            ownerId,
          );
        } catch (err) {
          console.error("[科目] 保存失敗、in-memory にフォールバック:", err);
          newSubject = buildLocal(`subj-manual-${Date.now()}`);
        }
      } else {
        newSubject = buildLocal(`subj-manual-${Date.now()}`);
        // mock-data 側にも push (admin/materials/new など他経路から見える)
        MOCK_SUBJECTS.push(newSubject);
      }

      setSubjects((prev) =>
        prev.some((s) => s.id === newSubject.id) ? prev : [...prev, newSubject],
      );
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
  // Phase 6 smoke test: buildNextTutorReplyAsync 経由で「計画立てよう」入口だけ Claude Opus 4.8 化。
  // フラグ off / それ以外 keyword は内部で同期 buildNextTutorReply に委譲、Claude 失敗時も mock fallback。
  const generateReply = useCallback(
    async ({ userInput }: { userInput: string; history: TutorMessage[] }): Promise<TutorMessage> => {
      const result = await buildNextTutorReplyAsync({
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
              navigate("material-detail", { materialId: readMaterial.id })
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
            nodes={nodes}
            issues={issues}
            scheduleItems={scheduleToday}
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
            onSeeAllSchedule={() => navigate("default")}
            onOpenDashboard={() => navigate("default")}
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
            subjects={subjects}
            learningLogs={learningLogs}
            studyMinutes={studyMinutes}
            onResolveIssue={handleResolveIssue}
            onReopenIssue={handleReopenIssue}
            onAppendChatMessages={handleAppendChatMessages}
            onSelectIssue={(id) => navigate("issue", { issueId: id })}
            onBack={() => navigate("default")}
            onMaterialAdded={handleMaterialAdded}
            onMaterialUpdated={handleMaterialUpdated}
            onMaterialDeleted={handleMaterialDeleted}
            onSubjectAdded={handleSubjectAdded}
            materials={materials}
            noteEntries={noteEntries}
            resumes={resumes}
            onNoteUpdated={handleNoteUpdated}
            onNoteDeleted={handleNoteDeleted}
            onOpenNoteSource={(materialId, page) =>
              navigate("material-read", { materialId, page })
            }
            onNavigate={navigate}
            calendar={calendarApi}
            plans={plans}
            onCreatePlan={handleCreatePlan}
            onExtendPlan={handleExtendPlan}
            onCompletePlan={handleCompletePlan}
            onRestartPlan={handleRestartPlan}
            onTogglePlanSkip={handleTogglePlanSkip}
            onDeletePlan={handleDeletePlan}
            onSubmitAssignment={handleSubmitAssignment}
            onDeleteAssignment={handleDeleteAssignment}
            onToggleAssignmentStatus={handleToggleAssignmentStatus}
            onStudyAssignment={(materialId) =>
              navigate("material-read", { materialId })
            }
            onAddResume={handleAddResume}
            onRenameResume={handleRenameResume}
            onSetDefaultResume={handleSetDefaultResume}
            onDeleteResume={handleDeleteResume}
            onMoveEntryToResume={handleMoveEntryToResume}
            onMoveEntryToSubject={handleMoveEntryToSubject}
            onCopyResume={handleCopyResume}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      )}
    </div>
  );
}
