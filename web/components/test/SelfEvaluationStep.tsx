"use client";

/**
 * SelfEvaluationStep - 「答えを思い出した? それともツールを使った?」
 * ルール 1「答えを思い出さない」の自己検証。これがメタ認知の本丸。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, ShieldAlert, Wrench } from "lucide-react";
import type { SelfEvaluationResult } from "@/lib/learn/types";

type Props = {
  selected: SelfEvaluationResult | null;
  onSelect: (v: SelfEvaluationResult) => void;
  onNext: () => void;
};

export function SelfEvaluationStep({ selected, onSelect, onNext }: Props) {
  return (
    <div className="flex h-full w-full justify-center overflow-auto p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <Brain className="size-6 text-primary" />
          <h1 className="text-lg font-semibold">自分はどう解いた?</h1>
          <p className="text-xs text-muted-foreground">
            ルール 1 のメタ認知: 暗記モードかツールモードか
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              さっきの問題、どうやって解いた?
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onSelect("tool-used")}
              className={`flex flex-col gap-2 rounded-lg border-2 p-4 text-left transition-colors ${
                selected === "tool-used"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-foreground/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <Wrench className="size-5 text-primary" />
                <span className="font-semibold">
                  論点を特定して、解法を呼び出して、適用した
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                = ツール使用モード。これが目指す状態。
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSelect("recalled")}
              className={`flex flex-col gap-2 rounded-lg border-2 p-4 text-left transition-colors ${
                selected === "recalled"
                  ? "border-destructive bg-destructive/10"
                  : "border-border bg-card hover:border-foreground/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-destructive" />
                <span className="font-semibold">
                  答えを思い出して、当てはめた
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                = 暗記モード。正解しても、これは矯正の対象。
              </p>
            </button>
          </CardContent>
        </Card>

        {selected === "recalled" && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-sm leading-relaxed text-card-foreground">
                <strong>正直に答えてくれてありがとう。</strong>{" "}
                これが一番大事な気づき。
                「思い出して解いた」と認められる人は、これから直していける。
                次のテストでは、論点 → 解法 → 適用 のサイクルを意識してみよう。
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={onNext}
            disabled={selected === null}
            className="gap-2"
          >
            <span>結果を見る</span>
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
