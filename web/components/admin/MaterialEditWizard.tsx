"use client";

/**
 * MaterialEditWizard - 教材登録の 4 ステップウィザード。
 *
 * Step 1: メタ情報 + PDF アップロード
 * Step 2: AI 抽出（mock プログレス）
 * Step 3: 監修（承認 / 編集 / 削除）
 * Step 4: 保存（mock では state のみ）
 */

import { useState } from "react";
import { Step1MetaAndUpload } from "./steps/Step1MetaAndUpload";
import { Step2Extraction } from "./steps/Step2Extraction";
import { Step3Review } from "./steps/Step3Review";
import { Step4Save } from "./steps/Step4Save";
import { mockExtractNodes } from "@/lib/admin/mock-extraction";
import type {
  AiExtractedNode,
  KnowledgeNode,
  MaterialDraft,
  Subject,
} from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  subjects: Subject[];
  existingNodes: KnowledgeNode[];
  /** URL クエリ等から渡される、初期選択する科目 ID */
  initialSubjectId?: string;
};

const STEP_LABELS = ["メタ情報・PDF", "AI 抽出", "監修", "保存"];

export function MaterialEditWizard({
  subjects,
  existingNodes,
  initialSubjectId,
}: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<MaterialDraft>({
    name: "",
    subjectId: initialSubjectId ?? subjects[0]?.id ?? "",
    label: "テキスト",
    gradeLevel: "中2",
    fileName: null,
    fileSize: null,
  });
  const [extracted, setExtracted] = useState<AiExtractedNode[]>([]);

  const goNext = () => setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));

  const handleExtractionDone = () => {
    setExtracted(mockExtractNodes(existingNodes));
    goNext();
  };

  const handleUpdateNode = (
    tempId: string,
    patch: Partial<AiExtractedNode>,
  ) => {
    setExtracted((prev) =>
      prev.map((n) => (n.tempId === tempId ? { ...n, ...patch } : n)),
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">新しい教材を登録</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF をアップロードすると、AI が体系図ノードを抽出します
        </p>
      </div>

      {/* ステップインジケータ */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "truncate text-xs",
                i === step
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1",
                  i < step ? "bg-primary/40" : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* ステップ本体 */}
      {step === 0 && (
        <Step1MetaAndUpload
          draft={draft}
          subjects={subjects}
          onChange={setDraft}
          onNext={goNext}
        />
      )}
      {step === 1 && (
        <Step2Extraction
          draft={draft}
          onComplete={handleExtractionDone}
          onBack={goPrev}
        />
      )}
      {step === 2 && (
        <Step3Review
          extracted={extracted}
          existingNodes={existingNodes}
          onUpdateNode={handleUpdateNode}
          onNext={goNext}
          onBack={goPrev}
        />
      )}
      {step === 3 && (
        <Step4Save
          draft={draft}
          extracted={extracted}
          onBack={goPrev}
        />
      )}
    </div>
  );
}
