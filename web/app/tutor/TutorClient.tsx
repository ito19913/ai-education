"use client";

/**
 * TutorClient - 担任「ゆい」さんとの chat の state ホルダー。
 *
 * Phase 2 mock: tutor-mock.ts のスクリプトに従って次の応答を生成。
 * Phase 3 で Claude API への置換を予定。
 */
import { useRef, useState } from "react";
import { TutorChat } from "@/components/tutor/TutorChat";
import {
  buildInitialTutorThread,
  buildNextTutorReply,
  type TutorStep,
} from "@/lib/learn/tutor-mock";
import type { KnowledgeNode, TutorMessage } from "@/lib/learn/types";

type Props = {
  nodes: KnowledgeNode[];
};

export function TutorClient({ nodes }: Props) {
  // 初回スレッド（useState lazy init で mount 時 1 回だけ計算）。
  // ref ではなく state にして render 中の current アクセスを避ける。
  const [initialMessages] = useState<TutorMessage[]>(
    () => buildInitialTutorThread().messages,
  );
  // mock 用の状態機械。ref は render 中に書き換える用途ではなく、
  // handler 内でのみ読み書きするので OK。
  const stepRef = useRef<TutorStep>({ state: "opening" });

  // 自由入力 → 次の AI 応答
  const generateReply = ({
    userInput,
  }: {
    userInput: string;
    history: TutorMessage[];
  }): TutorMessage => {
    const result = buildNextTutorReply({
      state: stepRef.current,
      userInput,
    });
    stepRef.current = result.nextState;
    return result.reply;
  };

  // 教科ピッカーで選択 → state を subject-picked に進めて応答
  const onPickSubject = (subjectId: string): TutorMessage => {
    stepRef.current = {
      ...stepRef.current,
      state: "subject-picked",
      proposedSubjectId: subjectId,
    };
    const result = buildNextTutorReply({
      state: stepRef.current,
      userInput: "",
    });
    stepRef.current = result.nextState;
    return result.reply;
  };

  // 教材ピッカーで選択 → state を material-picked に進めて応答
  const onPickMaterial = (materialId: string): TutorMessage => {
    stepRef.current = {
      ...stepRef.current,
      state: "material-picked",
      proposedMaterialId: materialId,
    };
    const result = buildNextTutorReply({
      state: stepRef.current,
      userInput: "",
    });
    stepRef.current = result.nextState;
    return result.reply;
  };

  return (
    <TutorChat
      initialMessages={initialMessages}
      nodes={nodes}
      generateReply={generateReply}
      onPickSubject={onPickSubject}
      onPickMaterial={onPickMaterial}
    />
  );
}
