"use client";

/**
 * MetaQuestionStep - 論点識別のメタ問題。
 * 「次の 4 問のうち、◯◯◯ を問うのはどれ？」
 * ルール 2「論点を特定する」の訓練。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
import type { KnowledgeNode, Question } from "@/lib/learn/types";

type Props = {
  targetNode: KnowledgeNode;
  questionPool: Question[];
  /** 候補となる 4 問（1 つが正解、3 つがダミー） */
  candidates: Question[];
  onChoose: (questionId: string) => void;
};

export function MetaQuestionStep({
  targetNode,
  candidates,
  onChoose,
}: Props) {
  return (
    <div className="flex h-full w-full justify-center overflow-auto p-6">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <Brain className="size-6 text-primary" />
          <h1 className="text-lg font-semibold">論点を特定する</h1>
          <p className="text-xs text-muted-foreground">
            ルール 2: どこの論点が問われているかを見抜く訓練
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              次の 4 問のうち、
              <span className="mx-1 rounded bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                {targetNode.name}
              </span>
              を問うているのはどれ?
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {candidates.map((q, idx) => (
              <button
                key={q.id}
                type="button"
                onClick={() => onChoose(q.id)}
                className="group flex flex-col gap-2 rounded-lg border-2 border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-sm font-semibold text-muted-foreground group-hover:border-primary group-hover:text-primary">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="whitespace-pre-line text-sm leading-relaxed text-card-foreground">
                    {q.prompt}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          ※ 答えを解く必要はありません。「どれが◯◯◯を問う問題か」だけを選んでください。
        </p>
      </div>
    </div>
  );
}
