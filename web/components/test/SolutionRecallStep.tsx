"use client";

/**
 * SolutionRecallStep - 論点の解法を自分の言葉で再構成する。
 * ルール 3「解法を呼び出して使う」の訓練。
 * MVP は textarea 入力。後で音声入力 + AI 評価に置き換え。
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Wrench } from "lucide-react";
import type { KnowledgeNode } from "@/lib/learn/types";

type Props = {
  targetNode: KnowledgeNode;
  onComplete: () => void;
};

export function SolutionRecallStep({ targetNode, onComplete }: Props) {
  const [text, setText] = useState("");
  const canProceed = text.trim().length > 0;

  return (
    <div className="flex h-full w-full justify-center overflow-auto p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <Wrench className="size-6 text-primary" />
          <h1 className="text-lg font-semibold">解法を呼び出す</h1>
          <p className="text-xs text-muted-foreground">
            ルール 3: 論点の解法を、自分の言葉で
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              「
              <span className="text-primary">{targetNode.name}</span>
              」を解くためのツール（解法）を、自分の言葉で説明してみて
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ※ 「自分が問題を解く時、どんな手順で考えるか」を書こう。
              <br />
              ※ 答えを思い出すのではなく、「この論点ならこう解く」を組み立てる練習。
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="例: 「〜すること」を主語・目的語・補語にしたい時は、to + 動詞 を置く..."
              className="min-h-32 bg-card"
            />
            <p className="text-xs text-muted-foreground">
              ※ 後で音声入力に対応予定。今はキーボードで入力してください。
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={onComplete}
            disabled={!canProceed}
            className="gap-2"
          >
            <span>この解法で問題に挑む</span>
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
