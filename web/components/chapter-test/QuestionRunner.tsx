"use client";

/**
 * QuestionRunner - 1 問ずつ出題、回答を集める。
 * progress bar 付き。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";
import type { Question } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  question: Question;
  currentIndex: number; // 0-origin
  totalQuestions: number;
  onChoose: (choiceIndex: number) => void;
};

export function QuestionRunner({
  question,
  currentIndex,
  totalQuestions,
  onChoose,
}: Props) {
  return (
    <div className="flex h-full w-full justify-center overflow-auto p-6">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Target className="size-6 text-primary" />
          <h1 className="text-lg font-semibold">単元完了テスト</h1>
          <p className="text-xs text-muted-foreground">
            問題 {currentIndex + 1} / {totalQuestions}
          </p>
          <div className="mt-1 flex gap-1.5">
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-colors",
                  i <= currentIndex ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>
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
