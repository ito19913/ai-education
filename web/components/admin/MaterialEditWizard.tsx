"use client";

/**
 * MaterialEditWizard - 教材登録の 3 ステップウィザード。
 *
 * 2026-05-25 grill 1 確定 9 (C31): Step3Review (監修) を撤去して 4 step → 3 step に簡素化。
 * Phase 6 で本物の葵先生 (Claude Opus) が体系図を生成するようになるが、
 * grill 確定 9 (人間監修ステップ全廃) + 確定 10 (テキスト忠実) に従い、葵生成をそのまま保存。
 * 誤りはチャットで気づいたら葵に修正させる方針。
 *
 * Step 1: メタ情報 + PDF アップロード
 * Step 2: AI 抽出（mock プログレス、Phase 6 で葵先生による体系図 + 評価コメント 2 レイヤに置換）
 * Step 3: 保存（mock では state のみ、Phase 7 で Supabase 永続化）
 */

import { useState } from "react";
import { Step1MetaAndUpload } from "./steps/Step1MetaAndUpload";
import { Step2Extraction } from "./steps/Step2Extraction";
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
  /**
   * true の時、外殻 (`mx-auto max-w-4xl p-6`) を外して /tutor 右ペインに収まる形にする。
   * Phase 3 追加実装: ゆい chat 経由で開く時に true。
   */
  embedded?: boolean;
  /**
   * 保存完了時のコールバック。
   * /tutor 右ペイン経由の時に親がゆい発話を追加して右ペインを閉じるために使う。
   */
  onComplete?: (materialName: string, approvedNodeCount: number) => void;
};

// C31 2026-05-25 grill 1 確定 9: 監修ステップ撤去で 4 step → 3 step
const STEP_LABELS = ["メタ情報・PDF", "AI 抽出", "保存"];

export function MaterialEditWizard({
  subjects,
  existingNodes,
  initialSubjectId,
  embedded = false,
  onComplete,
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

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-6",
        embedded
          ? "h-full overflow-y-auto p-5"
          : "mx-auto max-w-4xl p-6",
      )}
    >
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
        <Step4Save
          draft={draft}
          extracted={extracted}
          onBack={goPrev}
          onComplete={onComplete}
        />
      )}
    </div>
  );
}
