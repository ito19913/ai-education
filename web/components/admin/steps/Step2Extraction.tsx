"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import {
  EXTRACTION_STAGE_LABELS,
  type ExtractionStage,
} from "@/lib/admin/mock-extraction";
import type { MaterialDraft } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  draft: MaterialDraft;
  onComplete: () => void | Promise<void>;
  onBack: () => void;
  /**
   * C71 (2026-05-28): true の時、葵 (Claude) が裏で実抽出中。
   * 「保存に進む」を disabled + ラベル切替で 2 重押し防止 + 進捗を見せる。
   */
  isExtracting?: boolean;
  /** Claude 失敗時のエラーメッセージ (UI で「mock fallback で進めるよ」表示用) */
  extractionError?: string | null;
};

const STAGES: ExtractionStage[] = [
  "uploading",
  "ocr",
  "outline",
  "matching",
  "done",
];

export function Step2Extraction({
  draft,
  onComplete,
  onBack,
  isExtracting = false,
  extractionError = null,
}: Props) {
  const [stageIndex, setStageIndex] = useState(0);
  const isDone = stageIndex >= STAGES.length - 1;

  useEffect(() => {
    if (isDone) return;
    const t = setTimeout(() => setStageIndex((i) => i + 1), 1100);
    return () => clearTimeout(t);
  }, [stageIndex, isDone]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI が PDF を解析中</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            「{draft.fileName ?? draft.name}」を AI が読み込んで、
            体系図のノードを抽出しています。
          </p>

          <ul className="flex flex-col gap-2">
            {STAGES.map((stage, i) => {
              const status =
                i < stageIndex
                  ? "done"
                  : i === stageIndex
                    ? isDone
                      ? "done"
                      : "running"
                    : "pending";
              return (
                <li
                  key={stage}
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-3 text-sm",
                    status === "done" &&
                      "border-primary/30 bg-primary/5 text-foreground",
                    status === "running" &&
                      "border-primary bg-primary/10 text-foreground",
                    status === "pending" &&
                      "border-border bg-card text-muted-foreground",
                  )}
                >
                  {status === "done" ? (
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                  ) : status === "running" ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <div className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span>{EXTRACTION_STAGE_LABELS[stage]}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {extractionError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-amber-700">
              ⚠️ 葵 (Claude) の抽出に失敗したので、mock データで先に進めるよ。<br />
              <span className="text-xs text-muted-foreground">{extractionError}</span>
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={!isDone || isExtracting}
          className="gap-2"
        >
          <ArrowLeft />
          <span>戻る</span>
        </Button>
        <Button
          size="lg"
          onClick={onComplete}
          disabled={!isDone || isExtracting}
        >
          {isExtracting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>葵が抽出中…</span>
            </>
          ) : isDone ? (
            "保存に進む"
          ) : (
            "解析中…"
          )}
        </Button>
      </div>
    </div>
  );
}
