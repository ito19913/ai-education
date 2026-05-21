"use client";

/**
 * TestPreCeremony - テスト前の「悪い癖の強制矯正」3 ルール確認儀式。
 * スキップ不可。毎回必ず通る。
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Check, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onComplete: () => void;
};

const RULES = [
  {
    icon: ShieldAlert,
    title: "答えを思い出して解くことは絶対にしない",
    body: "「あの問題、答えは確か○○だった」と思い出して解こうとしていない？\nそれは暗記モードの罠。一切やめよう。",
    cta: "暗記モードを封印する",
  },
  {
    icon: Brain,
    title: "どこの論点が問われているかを特定する",
    body: "問題を見たら、まず「これは何の論点を問うているか」を考えよう。\n論点を見抜く力 = 「気づき」の訓練だよ。",
    cta: "論点を特定する",
  },
  {
    icon: Check,
    title: "その論点の解法を思い出して、目の前の問題に適用する",
    body: "論点が分かったら、それに紐づく解法（=ツール）を呼び出して、目の前の問題に適用する。\n解法さえ理解できれば、記憶する量は劇的に減る。",
    cta: "解法を呼び出して使う",
  },
];

export function TestPreCeremony({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const isLast = step === RULES.length - 1;
  const rule = RULES[step];
  const Icon = rule.icon;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <ShieldAlert className="size-6 text-primary" />
          <h1 className="text-lg font-semibold">悪い癖の強制矯正システム</h1>
          <p className="text-xs text-muted-foreground">
            テストを始める前に 3 つのルールを確認します。
            <br />
            これは点数のためではなく、「勉強の仕方」を直すための訓練です。
          </p>
          <p className="text-xs text-muted-foreground">
            ルール {step + 1} / {RULES.length}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="size-5 text-primary" />
              <span>{rule.title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-card-foreground">
              {rule.body}
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-3">
          <Button size="lg" onClick={handleNext} className="gap-2">
            <span>{isLast ? "テストを始める" : rule.cta}</span>
            <ArrowRight />
          </Button>
          {/* ステップインジケータ */}
          <div className="flex gap-1.5">
            {RULES.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-colors",
                  i <= step ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
