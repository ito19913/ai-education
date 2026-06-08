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
import { MaterialReadPane } from "@/components/materials/MaterialReadPane";
import { setSessionPdf } from "@/lib/admin/session-pdf-store";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import {
  fetchMaterials,
  insertMaterial,
  updateMaterialPdfPath,
  updateMaterialSegments,
  softDeleteMaterial,
  getCurrentUserId,
} from "@/lib/materials/materials-repo";
import {
  extractFullPageTexts,
  loadPdfDocument,
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
} from "@/lib/notes/resumes-repo";
import {
  fetchCustomSubjects,
  insertSubject,
} from "@/lib/subjects/subjects-repo";
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
  ChatMessage,
  ConceptSegment,
  ExamPrep,
  Homework,
  Issue,
  IssueChatMessage,
  KnowledgeNode,
  LearningSession,
  LessonReview,
  Material,
  NoteEntry,
  Resume,
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
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchResumes()
      .then((rows) => {
        if (!cancelled) setResumes(rows);
      })
      .catch((err) => console.error("[レジュメ冊] 一覧取得失敗:", err));
    return () => {
      cancelled = true;
    };
  }, []);
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
      }
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
    },
    [],
  );

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

  // ----- まとめノート N9①: 能動ゲート通過でエントリが刻まれた時 -----
  const handleNoteAdded = useCallback(
    (entry: NoteEntry) => {
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
    [],
  );

  const handleNoteUpdated = useCallback(
    (id: string, patch: { userNote?: string; status?: "understood" | "open" }) => {
      setNoteEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      );
      if (isSupabaseConfigured()) {
        void updateNoteEntry(id, patch).catch((err) =>
          console.error("[ノート] 更新失敗:", err),
        );
      }
    },
    [],
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
              gradeLevel: material.gradeLevel,
              coveredNodeIds: material.coveredNodeIds,
              extractedNodes: material.extractedNodes,
            },
            ownerId,
          );
          announceAndShow(saved);
          // まとまり区切りを裏で実行 (DB 保存あり)。PDF アップロードと並走してよい。
          runSegmentation(saved, true);

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
    [navigate, subjects],
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

      {view === "material-read" ? (
        // 段階1-C: 読書ビューはゆい左ペインを隠してフル幅の集中モードで表示
        readMaterial ? (
          <MaterialReadPane
            material={readMaterial}
            subject={
              subjects.find((s) => s.id === readMaterial.subjectId) ?? null
            }
            initialPage={readInitialPage}
            onBack={() =>
              navigate("material-detail", { materialId: readMaterial.id })
            }
            onOpenResume={() =>
              navigate("notes", { subjectId: readMaterial.subjectId })
            }
            resumes={resumes}
            onAddResume={handleAddResume}
            onNoteAdded={handleNoteAdded}
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
            noteEntries={noteEntries}
            resumes={resumes}
            onNoteUpdated={handleNoteUpdated}
            onNoteDeleted={handleNoteDeleted}
            onOpenNoteSource={(materialId, page) =>
              navigate("material-read", { materialId, page })
            }
            onAddResume={handleAddResume}
            onRenameResume={handleRenameResume}
            onSetDefaultResume={handleSetDefaultResume}
            onDeleteResume={handleDeleteResume}
            onMoveEntryToResume={handleMoveEntryToResume}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      )}
    </div>
  );
}
