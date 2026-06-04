"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Home, Save } from "lucide-react";
import type { AiExtractedNode, Material, MaterialDraft } from "@/lib/learn/types";

type Props = {
  draft: MaterialDraft;
  extracted: AiExtractedNode[];
  onBack: () => void;
  /**
   * 保存完了時に親に通知する。
   * - /admin/materials/new から呼ばれた時は未指定 → 既存 UI（教材一覧/学習画面リンク）を出す
   * - /tutor 右ペインから呼ばれた時は指定 → ゆいに完了発話 + 右ペインを閉じる動作を親が行う
   */
  onComplete?: (material: Material, approvedNodeCount: number) => void;
};

export function Step4Save({ draft, extracted, onBack, onComplete }: Props) {
  const [saved, setSaved] = useState(false);

  // 2026-05-25 grill 1 確定 9 (監修撤去) + 確定 10 (テキスト忠実、AI 解釈・取捨選択禁止):
  // 葵が抽出したノードはそのまま全保存する (人間が承認/編集して取捨選択しない)。
  const handleSave = () => {
    // MVP モック: in-memory の Material を構築して親に渡す (後で Supabase Insert に置き換え)。
    // coveredNodeIds は既存体系図ノードにマッチしたものだけ (matchToExistingNodes 由来)。
    const newMaterial: Material = {
      id: `mat-manual-${Date.now()}`,
      subjectId: draft.subjectId,
      name: draft.name,
      label: draft.label,
      gradeLevel: draft.gradeLevel,
      coveredNodeIds: extracted
        .map((n) => n.matchedNodeId)
        .filter((id): id is string => Boolean(id)),
      // 段階1-A: 教材固有の体系図 (目次から抽出した実単元 + ページ範囲)。
      // MaterialDetailView はこれがあれば共有 MOCK_TREE より優先表示する。
      extractedNodes: extracted,
    };
    console.log("[save material]", newMaterial, extracted);
    setSaved(true);
    onComplete?.(newMaterial, extracted.length);
  };

  if (saved) {
    // onComplete が指定されている時（/tutor 右ペイン経由）は、親が完了発話 + 右ペインクローズを担当するので
    // 既存の「教材一覧/学習画面」リンクは出さない。
    if (onComplete) {
      return (
        <div className="flex flex-col gap-4">
          <Card className="border-primary">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="mx-auto size-12 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">登録しました</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                「{draft.name}」を {extracted.length} ノードと紐付けて保存しました。
                <br />
                ゆい先生に伝えました。
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        <Card className="border-primary">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto size-12 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">登録しました</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              「{draft.name}」を {extracted.length} ノードと紐付けて保存しました。
              <br />
              （現状は mock のため、ページをリロードすると消えます。後で Supabase 連携で永続化します）
            </p>
          </CardContent>
        </Card>
        <div className="flex justify-center gap-3">
          <Link href="/admin/materials">
            <Button variant="outline" className="gap-2">
              <Home className="size-4" />
              <span>教材一覧に戻る</span>
            </Button>
          </Link>
          <Link href="/learn">
            <Button className="gap-2">
              <span>学習画面で確認</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">登録内容の確認</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <ConfirmRow label="教材名" value={draft.name} />
          <ConfirmRow label="科目" value={draft.subjectId} />
          <ConfirmRow label="種別" value={draft.label} />
          <ConfirmRow label="学年" value={draft.gradeLevel} />
          <ConfirmRow label="PDF" value={draft.fileName ?? "（未選択）"} />
          <ConfirmRow
            label="抽出ノード数"
            value={`${extracted.length} 件`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">抽出されたノード一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {extracted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ノードが抽出されませんでした。戻って AI 抽出をやり直してください。
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {extracted.map((n) => (
                <li key={n.tempId} className="text-card-foreground">
                  • {n.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({n.pageRange})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft />
          <span>戻る</span>
        </Button>
        <Button
          size="lg"
          onClick={handleSave}
          disabled={extracted.length === 0}
          className="gap-2"
        >
          <Save className="size-4" />
          <span>保存する</span>
        </Button>
      </div>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
