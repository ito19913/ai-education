"use client";

/**
 * AssignmentDialog - 宿題・テストの追加 (2026-06-09、kind="assignment")。
 *
 * 軽い登録 (タイトル / 種類 宿題・テスト / 科目 / 提出日 任意)。PDF は当面なし
 * (タイトルだけで登録可、grill 確定)。状態は「まだ」で開始。
 */
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssignmentType, Material, Subject } from "@/lib/learn/types";
import type { NewAssignmentInput } from "@/lib/materials/materials-repo";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  /** null = 新規追加 / 値あり = 編集 */
  assignment: Material | null;
  /**
   * 追加 or 更新 (id があれば更新)。PDF (問題) は任意で、あれば一緒にアップロード
   * (新規/差し替え両対応、grill: 無くてもタイトルだけで可)。
   */
  onSubmit: (input: NewAssignmentInput, pdfFile?: File, id?: string) => void;
  /** 削除 (編集時のみ) */
  onDelete: (id: string) => void;
};

export function AssignmentDialog({
  open,
  onOpenChange,
  subjects,
  assignment,
  onSubmit,
  onDelete,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AssignmentType>("homework");
  const [subjectId, setSubjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    if (!f) return;
    const ok =
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (ok) setPdfFile(f);
  };

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (assignment) {
      setName(assignment.name);
      setType(assignment.assignmentType ?? "homework");
      setSubjectId(assignment.subjectId);
      setDueDate(assignment.dueDate ?? "");
    } else {
      setName("");
      setType("homework");
      setSubjectId(subjects[0]?.id ?? "");
      setDueDate("");
    }
    setPdfFile(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, assignment, subjects]);

  const canSave = name.trim().length > 0 && subjectId.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSubmit(
      {
        subjectId,
        name: name.trim(),
        assignmentType: type,
        dueDate: dueDate || undefined,
      },
      pdfFile ?? undefined,
      assignment?.id,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {assignment ? "宿題・テストを編集" : "宿題・テストを追加"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-name">名前</Label>
            <Input
              id="as-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 数学ワーク p.20-25 / 英語 単語テスト"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>種類</Label>
              <Select
                value={type}
                onValueChange={(v) => setType((v as AssignmentType) ?? "homework")}
              >
                <SelectTrigger>
                  {/* base-ui は値(homework/test)を生表示するので名前に変換 */}
                  <SelectValue>
                    {(value) => (value === "test" ? "テスト" : "宿題")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homework">宿題</SelectItem>
                  <SelectItem value="test">テスト</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="as-due">
                {type === "test" ? "テスト日" : "提出日"}（任意）
              </Label>
              <Input
                id="as-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>科目</Label>
            <Select
              value={subjectId}
              onValueChange={(v) => setSubjectId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="科目を選ぶ">
                  {(value) =>
                    subjects.find((s) => s.id === value)?.name ?? "科目を選ぶ"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 問題の PDF (任意)。ドラッグ＆ドロップ or クリックで選択。AI と解く時に使う。 */}
          <div className="flex flex-col gap-1.5">
            <Label>問題のPDF（任意）</Label>
            {assignment?.pdfPath && !pdfFile && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                📎 PDF 登録済み（下から差し替えできます）
              </span>
            )}
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-5 text-center transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/60 hover:bg-muted/40",
              )}
            >
              <Upload className="size-5 text-muted-foreground" />
              {pdfFile ? (
                <span className="truncate text-xs text-foreground">
                  {pdfFile.name}（
                  {Math.round(pdfFile.size / 1024).toLocaleString()} KB）
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  PDF をここにドラッグ＆ドロップ、またはクリックで選択
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {pdfFile && (
              <button
                type="button"
                onClick={() => setPdfFile(null)}
                className="self-start text-[11px] text-muted-foreground hover:text-destructive"
              >
                取り消す
              </button>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          {assignment ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(`「${assignment.name}」を削除しますか？`)
                ) {
                  onDelete(assignment.id);
                  onOpenChange(false);
                }
              }}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              <span>削除</span>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave}>
              {assignment ? "保存" : "追加"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
