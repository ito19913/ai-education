"use client";

/**
 * ScoreResultStep - 単元完了テストのスコア + 合否表示。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import type { KnowledgeNode, Question } from "@/lib/learn/types";

type Props = {
  targetNode: KnowledgeNode;
  questions: Question[];
  answers: number[];
  passed: boolean;
  onProceed: () => void; // 合格時: 次のノードへ / 不合格時: 遡及画面へ
};

export function ScoreResultStep({
  targetNode,
  questions,
  answers,
  passed,
  onProceed,
}: Props) {
  const correctCount = answers.filter(
    (a, i) => a === questions[i].correctIndex,
  ).length;
  const total = questions.length;
  const ratio = Math.round((correctCount / total) * 100);

  return (
    <div className="flex h-full w-full justify-center overflow-auto p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-lg font-semibold">
            「{targetNode.name}」完了テスト 結果
          </h1>
        </div>

        <Card className={passed ? "border-primary" : "border-destructive/50"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {passed ? (
                <>
                  <CheckCircle2 className="size-5 text-primary" />
                  <span>合格 — このノードは理解できてる</span>
                </>
              ) : (
                <>
                  <XCircle className="size-5 text-destructive" />
                  <span>不合格 — このノードはまだ詰まってる</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">正解</p>
                <p className="text-3xl font-bold text-foreground">
                  {correctCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}/ {total}
                  </span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">正答率</p>
                <p className="text-3xl font-bold text-foreground">{ratio}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">合格ライン</p>
                <p className="text-3xl font-bold text-muted-foreground">66%</p>
              </div>
            </div>

            <hr className="border-border" />

            {passed ? (
              <p className="text-sm leading-relaxed text-card-foreground">
                「{targetNode.name}」のツールが使えるようになってる。
                次のノードに進もう、もしくは他の単元へ。
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-card-foreground">
                ここのツールがまだしっかり身についていない。
                一つ上の階層「
                <span className="font-semibold text-foreground">
                  （次の画面で確認）
                </span>
                」で診断して、どこから分からなくなったかを特定しよう。
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button size="lg" onClick={onProceed} className="gap-2">
            <span>{passed ? "次へ" : "遡って診断する"}</span>
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
