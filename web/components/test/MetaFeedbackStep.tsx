"use client";

/**
 * MetaFeedbackStep - メタ問題の正誤フィードバック。
 * 正解 → 次へ（論点確認）、不正解 → 「気づかなかった」を学ぶ。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import type { KnowledgeNode, Question } from "@/lib/learn/types";

type Props = {
  isCorrect: boolean;
  targetNode: KnowledgeNode;
  chosenQuestion: Question;
  correctQuestion: Question;
  chosenNodeName: string;
  onNext: () => void;
};

export function MetaFeedbackStep({
  isCorrect,
  targetNode,
  chosenQuestion,
  correctQuestion,
  chosenNodeName,
  onNext,
}: Props) {
  return (
    <div className="flex h-full w-full justify-center overflow-auto p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        {isCorrect ? (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-5 text-primary" />
                <span>論点を見抜けた</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-card-foreground">
                正解。この問題は「
                <span className="font-semibold text-primary">
                  {targetNode.name}
                </span>
                」を問うています。
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                次は、その論点の解法を自分の言葉で思い出してみよう。
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <XCircle className="size-5 text-destructive" />
                <span>気づけなかった</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-card-foreground">
                あなたが選んだ問題:
              </p>
              <div className="rounded-md border border-border bg-card p-3 text-sm">
                {chosenQuestion.prompt}
              </div>
              <p className="text-sm leading-relaxed text-card-foreground">
                これは「
                <span className="font-semibold">{chosenNodeName}</span>
                」を問う問題でした。「
                <span className="font-semibold text-primary">
                  {targetNode.name}
                </span>
                」ではありません。
              </p>
              <hr className="border-border" />
              <p className="text-sm leading-relaxed text-card-foreground">
                正解はこちら:
              </p>
              <div className="rounded-md border-2 border-primary bg-primary/5 p-3 text-sm">
                {correctQuestion.prompt}
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  この感覚を覚えておこう
                </p>
                <p className="mt-1 text-sm leading-relaxed text-card-foreground">
                  「気づかなかった」 — 知識はあったのに、この問題でその知識を使うとは気づけなかった。
                  これは 5 観点の中で一番価値のある気づきだよ。
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Button size="lg" onClick={onNext} className="gap-2">
            <span>{isCorrect ? "解法を思い出す" : "次へ進む"}</span>
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
