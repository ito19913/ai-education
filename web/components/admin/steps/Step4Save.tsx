"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Home, Save } from "lucide-react";
import type { AiExtractedNode, MaterialDraft } from "@/lib/learn/types";

type Props = {
  draft: MaterialDraft;
  extracted: AiExtractedNode[];
  onBack: () => void;
};

export function Step4Save({ draft, extracted, onBack }: Props) {
  const [saved, setSaved] = useState(false);
  const approved = extracted.filter(
    (n) => n.reviewStatus === "approved" || n.reviewStatus === "edited",
  );

  const handleSave = () => {
    // MVP モック: state だけ。後で Supabase Insert に置き換え。
    console.log("[save material]", draft, approved);
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="border-primary">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto size-12 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">登録しました</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              「{draft.name}」を {approved.length} ノードと紐付けて保存しました。
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
            label="承認したノード数"
            value={`${approved.length} 件`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">承認したノード一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {approved.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだ承認したノードがありません。戻って監修してください。
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {approved.map((n) => (
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
          disabled={approved.length === 0}
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
