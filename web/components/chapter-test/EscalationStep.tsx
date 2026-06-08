"use client";

/**
 * EscalationStep - 不合格時に親ノードで再診断するかを選ぶ。
 * 親が無い（ルート）場合は、全体見直しを促す。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUp, BookOpen, Home } from "lucide-react";
import Link from "next/link";
import type { KnowledgeNode } from "@/lib/learn/types";

type Props = {
  currentNode: KnowledgeNode;
  parentNode: KnowledgeNode | null;
  onEscalate: () => void; // 親で再診断
};

export function EscalationStep({ currentNode, parentNode, onEscalate }: Props) {
  if (!parentNode) {
    // ルートまで遡った
    return (
      <div className="flex h-full w-full justify-center overflow-auto p-6">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-5 text-primary" />
                <span>全体の基礎から、もう一度</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-card-foreground">
                「{currentNode.name}」までを診断しましたが、ここでも詰まっています。
                これは恥ずかしいことじゃない、むしろ大きな気づきだよ。
              </p>
              <p className="text-sm leading-relaxed text-card-foreground">
                <strong>
                  「文法そのもの」をどう捉えるか、全体の骨格から見直すタイミング。
                </strong>
                AI と一緒に、もう一度ゆっくり「中2 英語文法」の全体を辿ろう。
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Link href="/tutor">
              <Button size="lg" className="gap-2">
                <Home className="size-4" />
                <span>司令室に戻る</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full justify-center overflow-auto p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUp className="size-5 text-primary" />
              <span>一つ上の階層で診断しよう</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-card-foreground">
              「{currentNode.name}」が詰まっているということは、
              その上の階層「
              <span className="rounded bg-primary/15 px-1.5 py-0.5 font-semibold text-primary">
                {parentNode.name}
              </span>
              」のどこかから分かりにくくなっている可能性があります。
            </p>
            <p className="text-sm leading-relaxed text-card-foreground">
              「{parentNode.name}」全体で診断テストを受けて、どこから詰まっているかを特定しましょう。
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              💡{" "}
              「分からなくなったら一つ上に戻る」 — これが知識を整理する一番大事な習慣。
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={onEscalate} className="gap-2">
            <ArrowUp className="size-4" />
            <span>「{parentNode.name}」で診断する</span>
          </Button>
          <Link href="/tutor">
            <Button size="lg" variant="outline" className="gap-2">
              <Home className="size-4" />
              <span>一旦司令室に戻る</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
