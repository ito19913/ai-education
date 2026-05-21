"use client";

/**
 * TestWorkspace - テスト機能の親コンポーネント (state machine)。
 *
 * フロー:
 *   pre-ceremony → meta-question → meta-feedback
 *                                  ├ 正解 → solution-recall → actual-question → feedback → self-evaluation → summary
 *                                  └ 不正解 → summary（実問題はスキップ、次回再挑戦）
 */

import { useMemo, useState } from "react";
import { TestPreCeremony } from "./TestPreCeremony";
import { MetaQuestionStep } from "./MetaQuestionStep";
import { MetaFeedbackStep } from "./MetaFeedbackStep";
import { SolutionRecallStep } from "./SolutionRecallStep";
import { ActualQuestionStep } from "./ActualQuestionStep";
import { FeedbackStep } from "./FeedbackStep";
import { SelfEvaluationStep } from "./SelfEvaluationStep";
import { TestSummary } from "./TestSummary";
import type {
  DiagnosisCategory,
  KnowledgeNode,
  Question,
  SelfEvaluationResult,
} from "@/lib/learn/types";

type TestStep =
  | "pre-ceremony"
  | "meta-question"
  | "meta-feedback"
  | "solution-recall"
  | "actual-question"
  | "feedback"
  | "self-evaluation"
  | "summary";

type Props = {
  /** どのノードを問うか（メタ問題の target） */
  targetNode: KnowledgeNode;
  /** メタ問題の候補 4 問（1 つが正解、3 つがダミー） */
  candidates: Question[];
  /** 正解の問題 id */
  correctQuestionId: string;
  /** ノード id → ノード名（mocked） */
  nodesById: Record<string, KnowledgeNode>;
};

export function TestWorkspace({
  targetNode,
  candidates,
  correctQuestionId,
  nodesById,
}: Props) {
  const [step, setStep] = useState<TestStep>("pre-ceremony");
  const [chosenMetaQuestionId, setChosenMetaQuestionId] = useState<
    string | null
  >(null);
  const [actualChoiceIndex, setActualChoiceIndex] = useState<number | null>(
    null,
  );
  const [diagnosis, setDiagnosis] = useState<DiagnosisCategory | null>(null);
  const [selfEvaluation, setSelfEvaluation] =
    useState<SelfEvaluationResult | null>(null);

  const correctQuestion = useMemo(
    () => candidates.find((q) => q.id === correctQuestionId)!,
    [candidates, correctQuestionId],
  );
  const chosenMetaQuestion = useMemo(
    () => candidates.find((q) => q.id === chosenMetaQuestionId) ?? null,
    [candidates, chosenMetaQuestionId],
  );
  const isMetaCorrect = chosenMetaQuestionId === correctQuestionId;
  const isActualCorrect =
    actualChoiceIndex !== null &&
    actualChoiceIndex === correctQuestion.correctIndex;

  const handleRetry = () => {
    setStep("pre-ceremony");
    setChosenMetaQuestionId(null);
    setActualChoiceIndex(null);
    setDiagnosis(null);
    setSelfEvaluation(null);
  };

  switch (step) {
    case "pre-ceremony":
      return <TestPreCeremony onComplete={() => setStep("meta-question")} />;

    case "meta-question":
      return (
        <MetaQuestionStep
          targetNode={targetNode}
          questionPool={candidates}
          candidates={candidates}
          onChoose={(id) => {
            setChosenMetaQuestionId(id);
            setStep("meta-feedback");
          }}
        />
      );

    case "meta-feedback":
      if (!chosenMetaQuestion) return null;
      return (
        <MetaFeedbackStep
          isCorrect={isMetaCorrect}
          targetNode={targetNode}
          chosenQuestion={chosenMetaQuestion}
          correctQuestion={correctQuestion}
          chosenNodeName={
            nodesById[chosenMetaQuestion.nodeId]?.name ?? "別の論点"
          }
          onNext={() => {
            if (isMetaCorrect) {
              setStep("solution-recall");
            } else {
              setStep("summary");
            }
          }}
        />
      );

    case "solution-recall":
      return (
        <SolutionRecallStep
          targetNode={targetNode}
          onComplete={() => setStep("actual-question")}
        />
      );

    case "actual-question":
      return (
        <ActualQuestionStep
          question={correctQuestion}
          onChoose={(idx) => {
            setActualChoiceIndex(idx);
            setStep("feedback");
          }}
        />
      );

    case "feedback":
      if (actualChoiceIndex === null) return null;
      return (
        <FeedbackStep
          question={correctQuestion}
          chosenIndex={actualChoiceIndex}
          selectedDiagnosis={diagnosis}
          onSelectDiagnosis={setDiagnosis}
          onNext={() => setStep("self-evaluation")}
        />
      );

    case "self-evaluation":
      return (
        <SelfEvaluationStep
          selected={selfEvaluation}
          onSelect={setSelfEvaluation}
          onNext={() => setStep("summary")}
        />
      );

    case "summary":
      return (
        <TestSummary
          metaCorrect={isMetaCorrect}
          actualCorrect={isActualCorrect}
          diagnosis={diagnosis}
          selfEvaluation={selfEvaluation}
          onRetry={handleRetry}
        />
      );
  }
}
