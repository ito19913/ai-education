"use client";

/**
 * MaterialDetailView - 教材詳細ページ。
 *
 * 2026-05-25 grill 1 (教材アップロード設計) C32 ガワ実装。
 *
 * - 確定 5: 教材アップ後の動線は計画と疎結合 → 教材詳細ページで体系図/評価/葵 chat 完結
 * - 確定 11: 葵の教材出力 = 体系図 (テキスト忠実) + 評価コメント (葵の見解) 2 レイヤ
 * - 確定 12: 教材ごとに葵 chat 独立スレッド (本ページに集約)
 * - 確定 13: アップ完了動線 = ゆいから「葵が読んだよ、見る?」→ 本ページ展開
 *
 * 現状はガワのみ:
 * - 体系図プレビューは coveredNodeIds → KnowledgeNode のシンプルリスト
 * - 評価コメントは葵生成 mock テキスト (Phase 6 で Claude Opus 出力に置換)
 * - 葵 chat 入力欄は placeholder 表示のみ (Phase 6 で本物の chat スレッド実装)
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SubjectTeacherAvatar } from "@/components/ui/subject-teacher-avatar";
import { BookText, MessageCircle, Send, Sparkles } from "lucide-react";
import type { KnowledgeNode, Material, Subject } from "@/lib/learn/types";

type Props = {
  material: Material;
  subject: Subject | null;
  nodes: KnowledgeNode[];
};

export function MaterialDetailView({ material, subject, nodes }: Props) {
  const coveredNodes = material.coveredNodeIds
    .map((nodeId) => nodes.find((n) => n.id === nodeId))
    .filter((n): n is KnowledgeNode => n !== undefined);

  // 評価コメント mock (Phase 6 で葵先生 Claude Opus の本物出力に置換)
  const aoiReview = {
    coverage: `${material.name} は、${subject?.name ?? "この教科"}の${material.gradeLevel} 範囲を網羅していて、体系の骨格を掴むのに使えそう。`,
    difficulty: "難易度は標準的。基礎の解説が丁寧で、演習問題も着実にこなせる量。",
    fit: "今の学習段階にちょうど合っていると思う。最初の通読は焦らず、まずは骨格を掴むことを優先しよう。",
    notes: [
      "演習問題を解く時は、答えを見る前に必ず「自分の言葉で説明」してみよう。",
      "わからない用語に出会ったら、その場で「どうしてこの言葉が出てきたのか」を考えよう。",
      "1 回転目は完璧を目指さず、全体像を掴むことに集中。2 回転目から細部に入ろう。",
    ],
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto bg-canvas p-5">
      {/* 教材メタ */}
      <Card>
        <CardContent className="flex items-start gap-3 pt-5">
          {subject ? (
            <SubjectTeacherAvatar
              subjectId={subject.id}
              size={48}
              fallbackLetter={subject.teacher?.avatarLetter}
              className="shrink-0"
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <BookText className="size-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{material.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">{material.label}</Badge>
              <Badge variant="outline">{material.gradeLevel}</Badge>
              <span className="text-xs text-muted-foreground">
                {subject?.teacher?.displayName ?? "担当先生未設定"} 担当
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 葵の評価コメント (確定 11) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-amber-500" />
            <span>{subject?.teacher?.displayName ?? "葵先生"}が読んでみての評価</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">範囲</div>
            <p className="text-foreground">{aoiReview.coverage}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">難易度</div>
            <p className="text-foreground">{aoiReview.difficulty}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">あなたへのフィット</div>
            <p className="text-foreground">{aoiReview.fit}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">使い方のヒント</div>
            <ul className="ml-4 list-disc space-y-1 text-foreground">
              {aoiReview.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] italic text-muted-foreground">
            ※ 現状は mock 表示。Phase 6 で本物の {subject?.teacher?.displayName ?? "葵先生"}{" "}
            (Claude Opus) が教材を読んで体系図 + 評価コメントを生成します。
          </p>
        </CardContent>
      </Card>

      {/* 体系図プレビュー (確定 11: テキスト忠実なノード一覧) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookText className="size-4 text-primary" />
            <span>体系図 ({coveredNodes.length} ノード)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {coveredNodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              この教材にはまだノードが紐付いていません。
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {coveredNodes.slice(0, 20).map((node) => (
                <li
                  key={node.id}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <div className="font-medium">{node.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {node.description}
                  </div>
                </li>
              ))}
              {coveredNodes.length > 20 && (
                <li className="text-xs text-muted-foreground">
                  …他 {coveredNodes.length - 20} 件
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 葵 chat 入力欄 (確定 12: 教材ごと独立スレッド、Phase 6 で本実装) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="size-4 text-primary" />
            <span>{subject?.teacher?.displayName ?? "葵先生"}にこの教材について聞く</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Textarea
            placeholder={`例: 「この教材の第3章ってどんな内容?」「この問題集と前の教科書の違いは?」`}
            rows={3}
            disabled
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] italic text-muted-foreground">
              ※ 現状は placeholder 表示。Phase 6 で教材ごと独立 chat スレッドを実装します。
            </p>
            <Button size="sm" disabled className="gap-1.5">
              <Send className="size-3.5" />
              <span>送信</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
