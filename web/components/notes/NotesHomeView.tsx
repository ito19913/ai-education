"use client";

/**
 * NotesHomeView — まとめノートのホーム (N9①+N9②、2026-06-05)
 *
 * grill N2/N7: 子が見る地図は「ノート体系図③ 1 枚」がホーム。リスト⇄マップ切替。
 * N9②: 理解済み(緑) / 未理解 open(黄) を色分け。open は「もう一回説明してみる」で
 * 能動ゲート再実行 (review モード) → 通過で理解済みに昇格。
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen,
  List,
  Map as MapIcon,
  NotebookPen,
  PencilLine,
  Trash2,
  CheckCircle2,
  CircleDashed,
  RefreshCw,
  Plus,
  MoreVertical,
  Star,
  FolderInput,
  GraduationCap,
} from "lucide-react";
import { MindMapPane } from "@/components/learn/MindMapPane";
import { MarkdownText } from "@/components/chat/MarkdownText";
import { NoteGateDialog } from "@/components/notes/NoteGateDialog";
import { parsePageRange } from "@/lib/notes/concept-for-page";
import { defaultResumeName } from "@/lib/notes/resumes-repo";
import type {
  KnowledgeNode,
  Material,
  NoteEntry,
  Resume,
  Subject,
} from "@/lib/learn/types";

type NotePatch = { userNote?: string; status?: "understood" | "open" };

type Props = {
  entries: NoteEntry[];
  materials: Material[];
  /** 科目タブの表示名解決用 (R10 Phase 1) */
  subjects: Subject[];
  /** R10 Phase 2: レジュメ冊一覧 (冊タブ用) */
  resumes: Resume[];
  /** 初期選択する科目タブ (R10: 出典→レジュメ 往復でこの教科を開く) */
  initialSubjectId?: string;
  /** 出典「読む」→ 読書ビューの該当ページへ */
  onOpenSource: (materialId: string, page: number) => void;
  /** 自分メモ / ステータス更新 */
  onUpdateEntry: (id: string, patch: NotePatch) => void;
  /** エントリ削除 (論理削除) */
  onDeleteEntry: (id: string) => void;
  /** R10 Phase 2: 冊を追加 (同科目)。作成した Resume を返す */
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
};

export function NotesHomeView({
  entries,
  materials,
  subjects,
  resumes,
  initialSubjectId,
  onOpenSource,
  onUpdateEntry,
  onDeleteEntry,
  onAddResume,
  onRenameResume,
  onSetDefaultResume,
  onDeleteResume,
  onMoveEntryToResume,
  onMoveEntryToSubject,
}: Props) {
  const [mode, setMode] = useState<"list" | "map">("list");
  // N9②: 振り返り (open→理解済み 昇格) の review ダイアログ対象
  const [reviewEntry, setReviewEntry] = useState<NoteEntry | null>(null);
  // R10 Phase 2: 冊の 追加/リネーム ダイアログ + 削除確認
  const [bookDialog, setBookDialog] = useState<
    | { mode: "add"; value: string; moveEntryId?: string }
    | { mode: "rename"; value: string; targetId: string }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<Resume | null>(null);

  // ----- R10 Phase 1: 科目タブ (N4 違反是正、全科目混在をやめて科目で閉じる) -----
  // エントリのある科目だけをタブにする。表示名は subjects から解決 (無ければ「その他」)。
  const subjectTabs = useMemo(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const e of entries) {
      if (!seen.has(e.subjectId)) {
        seen.add(e.subjectId);
        order.push(e.subjectId);
      }
    }
    return order.map((id) => ({
      id,
      name: subjects.find((s) => s.id === id)?.name ?? "その他",
    }));
  }, [entries, subjects]);

  // 選択中の科目の「上書き」。初期値 = 親から渡された科目 (出典→レジュメ 往復)、無ければ
  // null (= 先頭タブを既定)。effect で同期せず描画時に有効値へ解決する (タブ構成が
  // 変わって上書きが無効になっても自動で先頭に戻る)。
  const [subjectOverride, setSubjectOverride] = useState<string | null>(
    initialSubjectId ?? null,
  );
  const selectedSubjectId =
    subjectOverride && subjectTabs.some((t) => t.id === subjectOverride)
      ? subjectOverride
      : (subjectTabs[0]?.id ?? null);

  const selectedSubjectName =
    subjectTabs.find((t) => t.id === selectedSubjectId)?.name ?? "その他";

  // ----- R10 Phase 2: 冊タブ (選択科目の冊。デフォルト冊を先頭に並べる) -----
  const subjectResumes = useMemo(() => {
    const list = resumes.filter(
      (r) => r.subjectId === selectedSubjectId && !r.deletedAt,
    );
    return [...list].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return 0;
    });
  }, [resumes, selectedSubjectId]);
  const hasBooks = subjectResumes.length > 0;
  const defaultBook = subjectResumes.find((r) => r.isDefault) ?? null;

  // 選択中の冊の「上書き」。null = 未操作 (= デフォルト冊を既定)。科目を変えたら無効化して
  // その科目のデフォルトに自動で戻る (描画時解決、effect なし)。
  const [bookOverride, setBookOverride] = useState<string | null>(null);
  const selectedBookId =
    bookOverride && subjectResumes.some((r) => r.id === bookOverride)
      ? bookOverride
      : (defaultBook?.id ?? subjectResumes[0]?.id ?? null);
  const selectedBook =
    subjectResumes.find((r) => r.id === selectedBookId) ?? null;

  // 冊名 (R10): 冊があればその名前、無ければ「科目名 + レジュメ」(Phase 1 フォールバック)。
  const bookName = selectedBook?.name ?? defaultResumeName(selectedSubjectName);

  // 選択科目 + 選択冊のエントリに絞る。冊が無ければ科目スコープ (Phase 1 互換)。
  // デフォルト冊は resume_id 未設定 (移行漏れ) のピースも拾う安全網。
  const scopedEntries = useMemo(() => {
    const bySubject = entries.filter((e) => e.subjectId === selectedSubjectId);
    if (!hasBooks || !selectedBookId) return bySubject;
    const isDefaultSelected = selectedBook?.isDefault ?? false;
    return bySubject.filter(
      (e) =>
        e.resumeId === selectedBookId ||
        (isDefaultSelected && !e.resumeId),
    );
  }, [entries, selectedSubjectId, hasBooks, selectedBookId, selectedBook]);

  const understoodCount = scopedEntries.filter(
    (e) => e.status === "understood",
  ).length;
  const openCount = scopedEntries.filter((e) => e.status === "open").length;

  // open を上に並べる (振り返りを促す)
  const sortedEntries = useMemo(
    () =>
      [...scopedEntries].sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status === "open" ? -1 : 1;
      }),
    [scopedEntries],
  );

  // NoteEntry → MindMapPane 用 (flat) + status 色分け
  const mapNodes = useMemo<KnowledgeNode[]>(
    () =>
      scopedEntries.map((e) => ({
        id: e.id,
        name: e.conceptName,
        parentId: e.parentRef ?? null,
        description: e.aiSummary,
      })),
    [scopedEntries],
  );
  const statusById = useMemo<Record<string, "understood" | "open">>(
    () => Object.fromEntries(scopedEntries.map((e) => [e.id, e.status])),
    [scopedEntries],
  );

  // 新規冊の自動名 (R10 Q5: 手入力の初期値、空ならこれでフォールバック)。
  const autoBookName = `${selectedSubjectName}レジュメ${subjectResumes.length + 1}`;

  const openAddBook = (moveEntryId?: string) =>
    setBookDialog({ mode: "add", value: autoBookName, moveEntryId });

  const submitBookDialog = async () => {
    if (!bookDialog) return;
    const name = bookDialog.value.trim();
    if (bookDialog.mode === "rename") {
      if (name) onRenameResume(bookDialog.targetId, name);
      setBookDialog(null);
      return;
    }
    if (!selectedSubjectId) return;
    const created = await onAddResume(selectedSubjectId, name || autoBookName);
    if (created) {
      if (bookDialog.moveEntryId) {
        onMoveEntryToResume(bookDialog.moveEntryId, created.id);
      } else {
        setBookOverride(created.id);
      }
    }
    setBookDialog(null);
  };

  const confirmDeleteBook = () => {
    if (!deleteTarget || !selectedSubjectId) return;
    onDeleteResume(deleteTarget.id, selectedSubjectId);
    if (bookOverride === deleteTarget.id) setBookOverride(null);
    setDeleteTarget(null);
  };

  // 削除する冊の中身の件数 (確認文言「中の N 個はデフォルト冊に移ります」)。
  const deleteTargetCount = deleteTarget
    ? entries.filter((e) => e.resumeId === deleteTarget.id).length
    : 0;

  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      {/* ヘッダー */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-4 py-2">
        <NotebookPen className="size-5 text-primary" />
        <span className="text-sm font-semibold">
          {subjectTabs.length === 0 ? "レジュメ" : bookName}
        </span>
        {subjectTabs.length > 0 && (
          <span className="text-xs text-muted-foreground">
            理解済み {understoodCount}・振り返り {openCount}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setMode("list")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              mode === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="size-3.5" />
            リスト
          </button>
          <button
            type="button"
            onClick={() => setMode("map")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              mode === "map"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapIcon className="size-3.5" />
            体系図
          </button>
        </div>
      </div>

      {/* 科目タブ (R10 Phase 1): エントリのある科目だけ。選ぶとその科目の冊だけ表示 */}
      {subjectTabs.length > 1 && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background/60 px-3 py-1.5">
          {subjectTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubjectOverride(t.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                t.id === selectedSubjectId
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* 冊タブ (R10 Phase 2): 選択科目の冊。⋯ で リネーム/デフォルト/削除、＋ で追加 */}
      {hasBooks && selectedSubjectId && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background/40 px-3 py-1.5">
          {subjectResumes.map((r) => {
            const active = r.id === selectedBookId;
            return (
              <div
                key={r.id}
                className={`flex shrink-0 items-center rounded-full ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setBookOverride(r.id)}
                  className={`flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-xs font-medium ${
                    active ? "" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.isDefault && (
                    <Star
                      className={`size-3 ${active ? "" : "text-amber-500"}`}
                      fill="currentColor"
                    />
                  )}
                  <span>{r.name}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className={`rounded-full p-1 ${
                          active
                            ? "hover:bg-primary-foreground/20"
                            : "hover:bg-muted"
                        }`}
                        title="この冊の操作"
                        aria-label="冊の操作"
                      />
                    }
                  >
                    <MoreVertical className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        setBookDialog({
                          mode: "rename",
                          value: r.name,
                          targetId: r.id,
                        })
                      }
                    >
                      <PencilLine className="size-4" />
                      名前を変える
                    </DropdownMenuItem>
                    {!r.isDefault && (
                      <DropdownMenuItem
                        onClick={() =>
                          onSetDefaultResume(r.id, selectedSubjectId)
                        }
                      >
                        <Star className="size-4" />
                        デフォルトにする
                      </DropdownMenuItem>
                    )}
                    {!r.isDefault && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 className="size-4" />
                          この冊を削除
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => openAddBook()}
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            title="この科目に冊を追加"
          >
            <Plus className="size-3.5" />
            冊を追加
          </button>
        </div>
      )}

      {/* 本体 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-sm text-muted-foreground">
            <NotebookPen className="size-10 text-muted-foreground/60" />
            <p>
              まだレジュメにしたものがないよ。
              <br />
              教材を「一緒に読む」で開いて、
              <strong>「✍️ ここをレジュメにする」</strong>
              から始めよう。
            </p>
          </div>
        ) : mode === "map" ? (
          <div className="h-[600px]">
            <MindMapPane
              nodes={mapNodes}
              currentNodeId=""
              onSelectNode={() => {}}
              viewTitle="レジュメ体系図"
              visibleNodeCount={mapNodes.length}
              statusById={statusById}
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {sortedEntries.map((e) => (
              <NoteEntryCard
                key={e.id}
                entry={e}
                materialName={
                  materials.find((m) => m.id === e.sourceMaterialId)?.name ?? null
                }
                // R10 Phase 2: 移動先候補 (同科目の他の冊)。hasBooks の時だけ振り分け表示。
                moveTargets={
                  hasBooks
                    ? subjectResumes.filter((r) => r.id !== e.resumeId)
                    : []
                }
                showMove={hasBooks}
                // R10: 科目を直す = 現在以外の全科目 (付け間違いの修正、移動先は
                // エントリの無い科目でも選べるよう subjects 全体から)。
                otherSubjects={subjects
                  .filter((s) => s.id !== e.subjectId)
                  .map((s) => ({ id: s.id, name: s.name }))}
                onOpenSource={onOpenSource}
                onUpdateEntry={onUpdateEntry}
                onDeleteEntry={onDeleteEntry}
                onStartReview={() => setReviewEntry(e)}
                onMoveTo={(resumeId) => onMoveEntryToResume(e.id, resumeId)}
                onMoveToNew={() => openAddBook(e.id)}
                onMoveToSubject={(subjectId) =>
                  onMoveEntryToSubject(e.id, subjectId)
                }
              />
            ))}
          </ul>
        )}
      </div>

      {/* N9②: 振り返り (open→理解済み) の能動ゲート再実行 */}
      <NoteGateDialog
        open={reviewEntry !== null}
        onOpenChange={(o) => {
          if (!o) setReviewEntry(null);
        }}
        mode="review"
        existingEntry={reviewEntry ?? undefined}
        onUpgraded={(id) => {
          onUpdateEntry(id, { status: "understood" });
          setReviewEntry(null);
        }}
      />

      {/* R10 Phase 2: 冊の 追加 / リネーム ダイアログ */}
      <Dialog
        open={bookDialog !== null}
        onOpenChange={(o) => {
          if (!o) setBookDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bookDialog?.mode === "rename" ? "冊の名前を変える" : "新しい冊を作る"}
            </DialogTitle>
            <DialogDescription>
              {bookDialog?.mode === "rename"
                ? "この冊の名前を変えられるよ。"
                : bookDialog?.moveEntryId
                  ? "新しい冊を作って、このレジュメをそこに移すよ。"
                  : "分野で分けたい時に新しい冊を作れるよ（例：英文法だけ）。"}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={bookDialog?.value ?? ""}
            autoFocus
            onChange={(ev) =>
              setBookDialog((prev) =>
                prev ? { ...prev, value: ev.target.value } : prev,
              )
            }
            onKeyDown={(ev) => {
              if (ev.key === "Enter") void submitBookDialog();
            }}
            placeholder={autoBookName}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBookDialog(null)}>
              やめる
            </Button>
            <Button onClick={() => void submitBookDialog()}>
              {bookDialog?.mode === "rename" ? "変える" : "作る"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* R10 Phase 2: 冊の削除確認 (中身はデフォルト冊へ移動) */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>「{deleteTarget?.name}」を削除する？</DialogTitle>
            <DialogDescription>
              {deleteTargetCount > 0
                ? `この冊の中の ${deleteTargetCount} 個のレジュメは、デフォルトの冊に移ります（中身は消えません）。`
                : "この冊は空っぽなので、そのまま削除するよ。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              やめる
            </Button>
            <Button variant="destructive" onClick={confirmDeleteBook}>
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoteEntryCard({
  entry,
  materialName,
  moveTargets,
  showMove,
  otherSubjects,
  onOpenSource,
  onUpdateEntry,
  onDeleteEntry,
  onStartReview,
  onMoveTo,
  onMoveToNew,
  onMoveToSubject,
}: {
  entry: NoteEntry;
  materialName: string | null;
  /** R10 Phase 2: 移動先候補 (同科目の他の冊) */
  moveTargets: Resume[];
  /** R10 Phase 2: 振り分けメニューを出すか (hasBooks) */
  showMove: boolean;
  /** R10: 科目を直す移動先 (現在以外の全科目) */
  otherSubjects: { id: string; name: string }[];
  onOpenSource: (materialId: string, page: number) => void;
  onUpdateEntry: (id: string, patch: NotePatch) => void;
  onDeleteEntry: (id: string) => void;
  onStartReview: () => void;
  /** R10 Phase 2: 既存の冊へ移す */
  onMoveTo: (resumeId: string) => void;
  /** R10 Phase 2: 新しい冊を作って移す */
  onMoveToNew: () => void;
  /** R10: 別の科目へ移す (付け間違いの修正) */
  onMoveToSubject: (subjectId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState(entry.userNote ?? "");

  const startPage = parsePageRange(entry.sourcePageRange)?.start ?? null;
  const isOpen = entry.status === "open";

  return (
    <Card className={isOpen ? "border-amber-300" : undefined}>
      <CardContent className="flex flex-col gap-2 py-3">
        <div className="flex items-start gap-2">
          {isOpen ? (
            <CircleDashed className="mt-0.5 size-4 shrink-0 text-amber-500" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{entry.conceptName}</span>
              {isOpen ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  振り返りたい
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  理解済み
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-card-foreground">
              <MarkdownText text={entry.aiSummary} />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  title="このレジュメの操作"
                  aria-label="操作"
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              {showMove && (
                <>
                  <DropdownMenuLabel className="flex items-center gap-1.5">
                    <FolderInput className="size-3.5" />
                    別のレジュメに移す
                  </DropdownMenuLabel>
                  {moveTargets.map((r) => (
                    <DropdownMenuItem
                      key={r.id}
                      onClick={() => onMoveTo(r.id)}
                      className="whitespace-nowrap"
                    >
                      {r.isDefault && (
                        <Star
                          className="size-4 shrink-0 text-amber-500"
                          fill="currentColor"
                        />
                      )}
                      {r.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onClick={onMoveToNew}
                    className="whitespace-nowrap"
                  >
                    <Plus className="size-4 shrink-0" />
                    新しい冊を作って移す
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {otherSubjects.length > 0 && (
                <>
                  <DropdownMenuLabel className="flex items-center gap-1.5">
                    <GraduationCap className="size-3.5" />
                    科目を直す
                  </DropdownMenuLabel>
                  {otherSubjects.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => onMoveToSubject(s.id)}
                      className="whitespace-nowrap"
                    >
                      {s.name}へ移す
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDeleteEntry(entry.id)}
              >
                <Trash2 className="size-4" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 出典 + 振り返り */}
        <div className="flex flex-wrap items-center gap-2 pl-6 text-xs text-muted-foreground">
          {materialName && (
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3" />
              出典: {materialName}
              {entry.sourcePageRange ? `（${entry.sourcePageRange}）` : ""}
            </span>
          )}
          {entry.sourceMaterialId && startPage !== null && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => onOpenSource(entry.sourceMaterialId!, startPage)}
            >
              <BookOpen className="size-3" />
              出典を読む
            </Button>
          )}
          {isOpen && (
            <Button
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={onStartReview}
            >
              <RefreshCw className="size-3" />
              もう一回説明してみる
            </Button>
          )}
        </div>

        {/* 自分メモ (N7: 子が所有) */}
        <div className="pl-6">
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="自分の覚え方・引っかかったところをメモ"
                className="min-h-[60px] resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    onUpdateEntry(entry.id, { userNote: memo });
                    setEditing(false);
                  }}
                >
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setMemo(entry.userNote ?? "");
                    setEditing(false);
                  }}
                >
                  やめる
                </Button>
              </div>
            </div>
          ) : entry.userNote ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-left text-xs text-amber-800 hover:bg-amber-100"
            >
              <PencilLine className="mt-0.5 size-3 shrink-0" />
              <span>{entry.userNote}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <PencilLine className="size-3" />
              自分メモを足す
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
