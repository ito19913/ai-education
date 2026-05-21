"use client";

/**
 * FeedbackStep - 実問題の正誤 + 5 観点フィードバック。
 * 不正解時は本人に「どの観点で詰まったか」を選んでもらう（MVP）。
 * 後で AI が自動診断する。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import {
  DIAGNOSIS_LABELS,
  type DiagnosisCategory,
  type Question,
} from "@/lib/learn/types";

type Props = {
  question: Question;
  chosenIndex: number;
  selectedDiagnosis: DiagnosisCategory | null;
  onSelectDiagnosis: (d: DiagnosisCategory) => void;
  onNext: () => void;
};

export function FeedbackStep({
  question,
  chosenIndex,
  selectedDiagnosis,
  onSelectDiagnosis,
  onNext,
}: Props) {
  const isCorrect = chosenIndex === question.correctIndex;
  const canProceed = isCorrect || selectedDiagnosis !== null;

  return (
    <div className="flex h-full w-full justify-center overflow-auto p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        {isCorrect ? (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-5 text-primary" />
                <span>正解! ツール使用モードで解けた</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-card-foreground">
                論点 → 解法 → 適用 のサイクルが完成。
                これがツール使用モード。
              </p>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">解説:</span>{" "}
                {question.explanation}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <XCircle className="size-5 text-destructive" />
                <span>不正解</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-md border border-border bg-card p-3 text-sm">
                <p className="text-xs text-muted-foreground">あなたの選択</p>
                <p className="mt-1 text-card-foreground">
                  {String.fromCharCode(65 + chosenIndex)}.{" "}
                  {question.choices[chosenIndex]}
                </p>
              </div>
              <div className="rounded-md border-2 border-primary bg-primary/5 p-3 text-sm">
                <p className="text-xs font-semibold text-primary">正解</p>
                <p className="mt-1 text-card-foreground">
                  {String.fromCharCode(65 + question.correctIndex)}.{" "}
                  {question.choices[question.correctIndex]}
                </p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">解説:</span>{" "}
                {question.explanation}
              </div>

              <hr className="border-border" />

              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-foreground">
                  どこで詰まったかな?(5 観点で振り返ろう)
                </p>
                <p className="text-xs text-muted-foreground">
                  「思い出せなかった」は選択肢にないよ。それは暗記モードの言い方。
                  下の 5 観点から選ぼう。
                </p>
                <div className="flex flex-col gap-1.5">
                  {(Object.keys(DIAGNOSIS_LABELS) as DiagnosisCategory[]).map(
                    (d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onSelectDiagnosis(d)}
                        className={`rounded-md border-2 p-2.5 text-left text-sm transition-colors ${
                          selectedDiagnosis === d
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card hover:border-foreground/40"
                        }`}
                      >
                        {DIAGNOSIS_LABELS[d]}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={onNext}
            disabled={!canProceed}
            className="gap-2"
          >
            <span>自己評価へ</span>
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
