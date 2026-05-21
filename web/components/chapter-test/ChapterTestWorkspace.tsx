"use client";

/**
 * ChapterTestWorkspace - 単元完了テスト（遡及式）の state machine。
 *
 * フロー:
 *   pre-ceremony → question (×N) → score
 *     ├─ 合格 → 「次へ」で学習画面か別ノード
 *     └─ 不合格 → escalation
 *           ├─ 親で再診断 → pre-ceremony から再開（targetNode を親に変更）
 *           └─ 一旦学習に戻る → /learn へ
 *
 * 「親まで遡って合格」の発見ロジックは MVP では本人の意思に委ねる
 * （自動連続診断ではなく、本人が「次の親で診断」を押す）。
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, RefreshCw } from "lucide-react";
import { TestPreCeremony } from "@/components/test/TestPreCeremony";
import { QuestionRunner } from "./QuestionRunner";
import { ScoreResultStep } from "./ScoreResultStep";
import { EscalationStep } from "./EscalationStep";
import {
  getParentNodeId,
  getQuestionsForNode,
  isPassing,
  pickQuestions,
} from "@/lib/learn/chapter-test-helpers";
import type { KnowledgeNode, Question } from "@/lib/learn/types";

type Step =
  | "pre-ceremony"
  | "question"
  | "score"
  | "escalation"
  | "passed-final";

type Props = {
  initialNodeId: string;
  allNodes: KnowledgeNode[];
  allQuestions: Question[];
  /** 出題する最大問題数（mock 問題が少ない場合の上限） */
  maxQuestionsPerLevel?: number;
};

export function ChapterTestWorkspace({
  initialNodeId,
  allNodes,
  allQuestions,
  maxQuestionsPerLevel = 3,
}: Props) {
  const [step, setStep] = useState<Step>("pre-ceremony");
  const [currentNodeId, setCurrentNodeId] = useState(initialNodeId);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const nodesById = useMemo(
    () => Object.fromEntries(allNodes.map((n) => [n.id, n])),
    [allNodes],
  );
  const currentNode = nodesById[currentNodeId];

  // 現在のテストで出題する問題（最大 maxQuestionsPerLevel）
  const questions = useMemo(() => {
    const pool = getQuestionsForNode(currentNodeId, allNodes, allQuestions);
    return pickQuestions(pool, maxQuestionsPerLevel);
  }, [currentNodeId, allNodes, allQuestions, maxQuestionsPerLevel]);

  const correctCount = answers.filter(
    (a, i) => a === questions[i]?.correctIndex,
  ).length;
  const passed = isPassing(correctCount, questions.length);

  const handleAnswer = (choiceIndex: number) => {
    const next = [...answers, choiceIndex];
    setAnswers(next);
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(questionIndex + 1);
    } else {
      setStep("score");
    }
  };

  const handleEscalate = () => {
    const parentId = getParentNodeId(currentNodeId, allNodes);
    if (!parentId) {
      // ルートまで来たので escalation 画面が「全体見直し」を表示している。何もしない。
      return;
    }
    setCurrentNodeId(parentId);
    setQuestionIndex(0);
    setAnswers([]);
    setStep("pre-ceremony");
  };

  const handleScoreProceed = () => {
    if (passed) {
      setStep("passed-final");
    } else {
      setStep("escalation");
    }
  };

  if (!currentNode) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          ノードが見つかりませんでした。
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="flex max-w-lg flex-col gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            「{currentNode.name}」には診断用の問題がまだ用意されていません。
          </p>
          <Link href="/learn">
            <Button>学習画面に戻る</Button>
          </Link>
        </div>
      </div>
    );
  }

  switch (step) {
    case "pre-ceremony":
      return <TestPreCeremony onComplete={() => setStep("question")} />;

    case "question":
      return (
        <QuestionRunner
          question={questions[questionIndex]}
          currentIndex={questionIndex}
          totalQuestions={questions.length}
          onChoose={handleAnswer}
        />
      );

    case "score":
      return (
        <ScoreResultStep
          targetNode={currentNode}
          questions={questions}
          answers={answers}
          passed={passed}
          onProceed={handleScoreProceed}
        />
      );

    case "escalation": {
      const parentId = getParentNodeId(currentNodeId, allNodes);
      const parentNode = parentId ? nodesById[parentId] : null;
      return (
        <EscalationStep
          currentNode={currentNode}
          parentNode={parentNode}
          onEscalate={handleEscalate}
        />
      );
    }

    case "passed-final":
      return (
        <div className="flex h-full w-full items-center justify-center overflow-auto p-6">
          <div className="flex w-full max-w-2xl flex-col gap-6">
            <div className="rounded-xl border-2 border-primary bg-primary/5 p-6">
              <h1 className="text-lg font-semibold text-foreground">
                合格 — 「{currentNode.name}」のツールが使える状態です
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-card-foreground">
                {currentNodeId !== initialNodeId ? (
                  <>
                    「{currentNode.name}」までは理解できてるみたい。
                    その下のノードに戻って、詰まってる箇所を学習し直そう。
                  </>
                ) : (
                  <>
                    このノードは完了。次のノードに進もう、もしくは別の単元へ。
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentNodeId(initialNodeId);
                  setQuestionIndex(0);
                  setAnswers([]);
                  setStep("pre-ceremony");
                }}
                className="gap-2"
              >
                <RefreshCw className="size-4" />
                <span>もう一回</span>
              </Button>
              <Link href="/learn">
                <Button className="gap-2">
                  <Home className="size-4" />
                  <span>学習画面に戻る</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      );
  }
}
