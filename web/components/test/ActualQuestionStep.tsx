"use client";

/**
 * ActualQuestionStep - 実問題を、思い出した解法を適用して解く。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";
import type { Question } from "@/lib/learn/types";

type Props = {
  question: Question;
  onChoose: (choiceIndex: number) => void;
};

export function ActualQuestionStep({ question, onChoose }: Props) {
  return (
    <div className="flex h-full w-full justify-center overflow-auto p-6">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <Target className="size-6 text-primary" />
          <h1 className="text-lg font-semibold">解法を適用する</h1>
          <p className="text-xs text-muted-foreground">
            さっき思い出した解法を、この問題に当てはめてみよう
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <span className="whitespace-pre-line">{question.prompt}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {question.choices.map((choice, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChoose(idx)}
                className="group flex items-center gap-3 rounded-lg border-2 border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-sm font-semibold text-muted-foreground group-hover:border-primary group-hover:text-primary">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-sm leading-relaxed text-card-foreground">
                  {choice}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
