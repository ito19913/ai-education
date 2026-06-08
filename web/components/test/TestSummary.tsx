"use client";

/**
 * TestSummary - テスト結果サマリー。
 * 1 サイクルの結果（メタ正誤 / 実問題正誤 / 自己評価）を表示。
 * 後で複数問題のスコアと 5 観点ヒートを実装。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import {
  DIAGNOSIS_LABELS,
  type DiagnosisCategory,
  type SelfEvaluationResult,
} from "@/lib/learn/types";

type Props = {
  metaCorrect: boolean;
  actualCorrect: boolean;
  diagnosis: DiagnosisCategory | null;
  selfEvaluation: SelfEvaluationResult | null;
  onRetry: () => void;
};

export function TestSummary({
  metaCorrect,
  actualCorrect,
  diagnosis,
  selfEvaluation,
  onRetry,
}: Props) {
  return (
    <div className="flex h-full w-full justify-center overflow-auto p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-center text-lg font-semibold">
          今回のテストの振り返り
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">結果</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ResultRow
              label="論点の特定（メタ問題）"
              passed={metaCorrect}
            />
            <ResultRow
              label="解法の適用（実問題）"
              passed={actualCorrect}
            />
            <ResultRow
              label="ツール使用モードで解いた"
              passed={selfEvaluation === "tool-used"}
            />
          </CardContent>
        </Card>

        {diagnosis && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">今回の詰まり</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border-2 border-primary bg-primary/10 p-3">
                <p className="text-sm font-semibold text-primary">
                  {DIAGNOSIS_LABELS[diagnosis]}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  次回はこの観点を意識しよう。
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm leading-relaxed text-card-foreground">
              テストは点数を測るためじゃない。
              <br />
              <strong>「悪い癖（暗記モード）」を強制的に矯正</strong>{" "}
              するための訓練。
              <br />
              うまくいかなくても OK。気づけたことが成果だよ。
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={onRetry} variant="outline" className="gap-2">
            <RefreshCw className="size-4" />
            <span>もう一回</span>
          </Button>
          <Link href="/tutor">
            <Button className="gap-2">
              <span>司令室に戻る</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          passed ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
        }`}
      >
        {passed ? <Check className="size-4" /> : <X className="size-4" />}
      </div>
      <span className="text-sm text-card-foreground">{label}</span>
    </div>
  );
}
