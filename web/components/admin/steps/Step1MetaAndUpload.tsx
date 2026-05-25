"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, FileText, Upload } from "lucide-react";
import type {
  MaterialDraft,
  MaterialLabel,
  Subject,
} from "@/lib/learn/types";
import { cn } from "@/lib/utils";

/** Select で「+ 新規科目を追加…」が選ばれた時の特殊 value。2026-05-25 grill 2 S8 由来 */
const ADD_NEW_SUBJECT_VALUE = "__ADD_NEW_SUBJECT__";

type Props = {
  draft: MaterialDraft;
  subjects: Subject[];
  onChange: (draft: MaterialDraft) => void;
  onNext: () => void;
};

const LABELS: MaterialLabel[] = ["テキスト", "問題集", "副教材"];
const GRADES = ["中1", "中2", "中3", "高1", "高2", "高3"];

export function Step1MetaAndUpload({
  draft,
  subjects,
  onChange,
  onNext,
}: Props) {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    onChange({
      ...draft,
      fileName: file?.name ?? null,
      fileSize: file?.size ?? null,
    });
  };

  const canProceed =
    draft.name.trim().length > 0 &&
    draft.subjectId.length > 0 &&
    draft.fileName !== null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">メタ情報</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="material-name">教材名 *</Label>
            <Input
              id="material-name"
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              placeholder="例: 中2 英語 教科書 (光村図書)"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label>科目 *</Label>
              <Select
                value={draft.subjectId}
                onValueChange={(v) => {
                  if (v === ADD_NEW_SUBJECT_VALUE) {
                    router.push("/tutor?view=subjects");
                    return;
                  }
                  onChange({ ...draft, subjectId: v ?? "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  <div className="my-1 border-t" />
                  <SelectItem value={ADD_NEW_SUBJECT_VALUE} className="text-primary">
                    + 新規科目を追加…
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>種別</Label>
              <Select
                value={draft.label}
                onValueChange={(v) =>
                  onChange({
                    ...draft,
                    label: (v ?? "テキスト") as MaterialLabel,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>学年</Label>
              <Select
                value={draft.gradeLevel}
                onValueChange={(v) =>
                  onChange({ ...draft, gradeLevel: v ?? "中2" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">PDF アップロード</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0] ?? null;
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-foreground/40",
            )}
          >
            {draft.fileName ? (
              <>
                <FileText className="size-8 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  {draft.fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {draft.fileSize !== null
                    ? `${(draft.fileSize / 1024 / 1024).toFixed(2)} MB`
                    : ""}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  クリックして変更
                </p>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" />
                <p className="text-sm text-foreground">
                  PDF をここにドラッグ&ドロップ、またはクリックで選択
                </p>
                <p className="text-xs text-muted-foreground">
                  対応形式: PDF（教科書、問題集、副教材）
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!canProceed}
          onClick={onNext}
          className="gap-2"
        >
          <span>AI 抽出に進む</span>
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
