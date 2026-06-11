"use client";

/**
 * MaterialsListPane - 教材ペイン (2026-06-09 再設計、grill 確定)。
 *
 * 教材を「長期の本」と「宿題・テスト」の 2 エリアに分けて表示する。
 * - 📚 本棚 (kind="book"): 科目グループ + 表紙サムネのグリッド (従来)。
 * - 📝 宿題・テスト (kind="assignment"): リスト + フィルタ (科目/種類/状態) + 並び替え
 *   (新しい順/提出日)。「やった」は既定で隠す (数が多いので片付く)。
 *
 * イシュー(=「課題」)とは別物。宿題・テストは「学校から来てアップして AI と解くやること」。
 */
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubjectTeacherAvatar } from "@/components/ui/subject-teacher-avatar";
import {
  Book,
  BookOpen,
  BookText,
  Check,
  ClipboardList,
  GraduationCap,
  Paperclip,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AssignmentStatus,
  AssignmentType,
  Material,
  Subject,
} from "@/lib/learn/types";
import type { NewAssignmentInput } from "@/lib/materials/materials-repo";
import { AssignmentDialog } from "./AssignmentDialog";

type Props = {
  materials: Material[];
  subjects: Subject[];
  onSubmitAssignment: (
    input: NewAssignmentInput,
    pdfFile?: File,
    id?: string,
  ) => void;
  onDeleteAssignment: (id: string) => void;
  onToggleAssignmentStatus: (id: string, status: AssignmentStatus) => void;
  onStudyAssignment: (materialId: string) => void;
};

function ymdToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysUntil(dateStr: string): number {
  const a = new Date(ymdToday());
  const b = new Date(dateStr);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** 小さな segmented トグル */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
            value === o.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MaterialsListPane({
  materials,
  subjects,
  onSubmitAssignment,
  onDeleteAssignment,
  onToggleAssignmentStatus,
  onStudyAssignment,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  // 編集対象 (null = 新規追加)
  const [editingAssignment, setEditingAssignment] = useState<Material | null>(
    null,
  );
  // 上部タブ: 本棚 / 宿題・テスト (縦積みだと下が遠いので切替に、2026-06-09 ito19 さん)。
  // ダッシュボード「宿題・テスト すべて見る」(?tab=assignments) から来た時は宿題タブで開く。
  const [activeTab, setActiveTab] = useState<"books" | "assignments">(
    searchParams.get("tab") === "assignments" ? "assignments" : "books",
  );

  // 宿題・テストのフィルタ / 並び替え
  const [statusFilter, setStatusFilter] = useState<"todo" | "done" | "all">(
    "todo",
  );
  const [typeFilter, setTypeFilter] = useState<"all" | AssignmentType>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "due" | "subject">("recent");

  const books = useMemo(
    () => materials.filter((m) => (m.kind ?? "book") === "book"),
    [materials],
  );
  const assignments = useMemo(
    () => materials.filter((m) => m.kind === "assignment"),
    [materials],
  );

  // 本棚: 科目グループ
  const bookGroups = useMemo(() => {
    const map = new Map<string, Material[]>();
    for (const m of books) {
      const arr = map.get(m.subjectId) ?? [];
      arr.push(m);
      map.set(m.subjectId, arr);
    }
    return subjects
      .map((s) => ({ subject: s, list: map.get(s.id) ?? [] }))
      .filter(({ list }) => list.length > 0);
  }, [books, subjects]);

  // 宿題・テスト: フィルタ + 並び替え
  const filteredAssignments = useMemo(() => {
    let list = assignments.filter((a) => {
      const status = a.assignmentStatus ?? "todo";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (typeFilter !== "all" && a.assignmentType !== typeFilter) return false;
      if (subjectFilter !== "all" && a.subjectId !== subjectFilter) return false;
      return true;
    });
    if (sortBy === "due") {
      list = [...list].sort((x, y) => {
        if (!x.dueDate && !y.dueDate) return 0;
        if (!x.dueDate) return 1;
        if (!y.dueDate) return -1;
        return x.dueDate.localeCompare(y.dueDate);
      });
    } else if (sortBy === "subject") {
      const nameOf = (id: string) =>
        subjects.find((s) => s.id === id)?.name ?? "";
      list = [...list].sort((x, y) =>
        nameOf(x.subjectId).localeCompare(nameOf(y.subjectId), "ja"),
      );
    } else {
      // 新しい順 (fetch は created_at 昇順なので末尾が新しい → 逆順)
      list = [...list].reverse();
    }
    return list;
  }, [assignments, statusFilter, typeFilter, subjectFilter, sortBy, subjects]);

  const subjectName = (id: string) =>
    subjects.find((s) => s.id === id)?.name ?? "";

  // 科目フィルタの候補 (宿題・テストが存在する科目のみ)
  const assignmentSubjects = useMemo(() => {
    const ids = new Set(assignments.map((a) => a.subjectId));
    return subjects.filter((s) => ids.has(s.id));
  }, [assignments, subjects]);

  // タブ用「まだ」件数
  const todoCount = assignments.filter(
    (a) => (a.assignmentStatus ?? "todo") === "todo",
  ).length;

  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 p-5">
          {/* ヘッダー (温かめのトーン) */}
          <header className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <BookText className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">教材</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                長く使う本も、学校の宿題・テストも、ここから。気になるものを開いて先生と一緒に進めよう。
              </p>
            </div>
          </header>

          {/* 上部タブ: 本棚 / 宿題・テスト + アクティブ側の追加ボタン */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center rounded-md border border-border p-0.5">
              {(
                [
                  { key: "books", label: "本棚", count: books.length },
                  {
                    key: "assignments",
                    label: "宿題・テスト",
                    count: todoCount,
                  },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
                    activeTab === t.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.key === "books" ? (
                    <BookText className="size-3.5" />
                  ) : (
                    <ClipboardList className="size-3.5" />
                  )}
                  <span>{t.label}</span>
                  <span className="tabular-nums opacity-70">{t.count}</span>
                </button>
              ))}
            </div>
            {activeTab === "books" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/tutor?view=material-new")}
                className="h-7 gap-1 text-xs"
              >
                <Plus className="size-3.5" />
                <span>本を追加</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingAssignment(null);
                  setAssignmentDialogOpen(true);
                }}
                className="h-7 gap-1 text-xs"
              >
                <Plus className="size-3.5" />
                <span>宿題・テストを追加</span>
              </Button>
            )}
          </div>

          {/* ===== 📚 本棚 ===== */}
          {activeTab === "books" && (
            <div className="flex flex-col gap-3">
            {bookGroups.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                  <Book className="size-7 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    まだ本が登録されていません。「本を追加」から始めよう。
                  </p>
                </CardContent>
              </Card>
            ) : (
              bookGroups.map(({ subject, list }) => (
                <Card key={subject.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <SubjectTeacherAvatar
                        subjectId={subject.id}
                        size={24}
                        fallbackLetter={subject.teacher?.avatarLetter}
                      />
                      <span>{subject.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        ({list.length} 冊)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                      {list.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            router.push(
                              `/tutor?view=material-detail&id=${encodeURIComponent(m.id)}`,
                            )
                          }
                          className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-2 text-left transition-colors hover:border-primary hover:bg-primary/5"
                          title={m.name}
                        >
                          {m.coverThumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.coverThumb}
                              alt=""
                              className="aspect-[3/4] w-full rounded-md border border-border bg-muted object-cover shadow-sm"
                            />
                          ) : (
                            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-md border border-border bg-muted shadow-sm">
                              <Book className="size-8 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="flex flex-1 flex-col gap-1">
                            <div className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                              {m.name}
                            </div>
                            <div className="mt-auto flex flex-wrap items-center gap-1">
                              <Badge variant="outline" className="text-[9px]">
                                {m.label}
                              </Badge>
                              {m.gradeLevel && (
                                <Badge variant="outline" className="text-[9px]">
                                  {m.gradeLevel}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
            </div>
          )}

          {/* ===== 📝 宿題・テスト ===== */}
          {activeTab === "assignments" && (
            <Card>
              <CardContent className="flex flex-col gap-3 py-3">
                {/* フィルタ / 並び替え */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Segmented
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { key: "todo", label: "まだ" },
                      { key: "done", label: "やった" },
                      { key: "all", label: "すべて" },
                    ]}
                  />
                  <Segmented
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={[
                      { key: "all", label: "全種類" },
                      { key: "homework", label: "宿題" },
                      { key: "test", label: "テスト" },
                    ]}
                  />
                  <Segmented
                    value={sortBy}
                    onChange={setSortBy}
                    options={[
                      { key: "recent", label: "新しい順" },
                      { key: "due", label: "提出日順" },
                      { key: "subject", label: "科目順" },
                    ]}
                  />
                  {assignmentSubjects.length > 1 && (
                    <Select
                      value={subjectFilter}
                      onValueChange={(v) => setSubjectFilter(v ?? "all")}
                    >
                      <SelectTrigger size="sm" className="h-7 text-[11px]">
                        <SelectValue>
                          {(value) =>
                            value === "all"
                              ? "全科目"
                              : (subjectName(value as string) || "全科目")
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全科目</SelectItem>
                        {assignmentSubjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* リスト */}
                {filteredAssignments.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    {assignments.length === 0
                      ? "宿題・テストはまだありません。「宿題・テストを追加」から登録しよう。"
                      : "この条件に合う宿題・テストはありません。"}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {filteredAssignments.map((a) => {
                      const done = (a.assignmentStatus ?? "todo") === "done";
                      const isTest = a.assignmentType === "test";
                      const dl =
                        a.dueDate != null ? daysUntil(a.dueDate) : null;
                      return (
                        <li
                          key={a.id}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2",
                            done && "opacity-60",
                          )}
                        >
                          {/* まだ/やった トグル */}
                          <button
                            type="button"
                            onClick={() =>
                              onToggleAssignmentStatus(
                                a.id,
                                done ? "todo" : "done",
                              )
                            }
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                              done
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-muted-foreground/40 hover:border-emerald-500",
                            )}
                            title={done ? "「まだ」に戻す" : "「やった」にする"}
                          >
                            {done && <Check className="size-3" />}
                          </button>

                          {/* 中身クリックで編集 (名前/種類/科目/提出日/PDF差し替え/削除) */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAssignment(a);
                              setAssignmentDialogOpen(true);
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                            title="クリックで編集"
                          >
                            {/* 一番左に科目ラベル (英語・法人税 …) */}
                            <span className="inline-flex w-16 shrink-0 items-center justify-center truncate rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                              {subjectName(a.subjectId) || "—"}
                            </span>

                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                                isTest
                                  ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                              )}
                            >
                              {isTest ? (
                                <GraduationCap className="size-3" />
                              ) : (
                                <ClipboardList className="size-3" />
                              )}
                              {isTest ? "テスト" : "宿題"}
                            </span>

                            <span
                              className={cn(
                                "flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-foreground",
                                done && "line-through",
                              )}
                            >
                              <span className="truncate">{a.name}</span>
                              {a.pdfPath && (
                                <Paperclip
                                  className="size-3 shrink-0 text-muted-foreground"
                                  aria-label="PDF あり"
                                />
                              )}
                            </span>

                            {a.dueDate && (
                              <span
                                className={cn(
                                  "shrink-0 text-[11px] tabular-nums",
                                  !done && dl !== null && dl <= 2
                                    ? "font-semibold text-orange-600 dark:text-orange-400"
                                    : "text-muted-foreground",
                                )}
                              >
                                {isTest ? "テスト" : "提出"}{" "}
                                {a.dueDate.slice(5).replace("-", "/")}
                                {!done && dl !== null && dl >= 0 && (
                                  <span className="ml-1">
                                    {dl === 0 ? "今日" : `あと${dl}日`}
                                  </span>
                                )}
                              </span>
                            )}
                          </button>

                          {/* 学習する: PDF があれば読書ビューで葵と解く。
                              問題 (PDF) が無いときは押せない (遷移しない、2026-06-09 ito19 さん)。 */}
                          <Button
                            size="sm"
                            variant={a.pdfPath ? "default" : "outline"}
                            disabled={!a.pdfPath}
                            onClick={() => onStudyAssignment(a.id)}
                            className="h-7 shrink-0 gap-1 px-2 text-xs"
                            title={
                              a.pdfPath
                                ? "葵先生と一緒に解く"
                                : "問題PDFをアップすると学習できます（行をクリックして追加）"
                            }
                          >
                            <BookOpen className="size-3.5" />
                            <span>学習する</span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        subjects={subjects}
        assignment={editingAssignment}
        onSubmit={onSubmitAssignment}
        onDelete={onDeleteAssignment}
      />
    </div>
  );
}
