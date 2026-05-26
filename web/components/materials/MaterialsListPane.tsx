"use client";

/**
 * MaterialsListPane - 教材一覧ペイン (C44 2026-05-26 ito19 さん意見、残課題⑤ 解消)。
 *
 * grill 1 確定 12「教材ごと独立葵 chat スレッド = 教材詳細ページに集約」を機能させる
 * ためには、教材詳細ページが「常に再アクセス可能な拠点」である必要がある。
 * しかし C32-C42 時点では (a) アップロード直後の自動展開 (b) URL 直接アクセス しか
 * 入口が無く、後日再アクセス動線が存在しなかった (= 隠れ取り残し論点⑤)。
 *
 * 本 component はゆいメニュー「教材」ボタン (TutorChat.tsx) → 「教材一覧」発話 →
 * tutor-mock 分岐 → open-materials → 本ペイン展開、の動線で表示される。
 *
 * - 科目別 grouping の縦リスト (subjects 順、教材 0 件の科目はスキップ)
 * - 各教材クリックで `/tutor?view=material-detail&id=xxx` 遷移 → MaterialDetailView
 *   (体系図フローチャート + 評価コメント + 葵 chat、C32/C40/C41/C43 で組み上げ済)
 * - 末尾「+ 新規教材を追加」リンク (dashed border、SubjectPickerCard C29 / MaterialPickerCard C36 と同じパターン)
 *
 * 残課題 (本セッション中は対応せず、後続 commit で):
 * - D: 各教材に「スケジュール組み込み状況」表示
 * - E: 各教材から「スケジュール画面」遷移リンク
 * - F: 各教材に「編集」ボタン
 */
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubjectTeacherAvatar } from "@/components/ui/subject-teacher-avatar";
import { Book, BookText, Plus } from "lucide-react";
import type { Material, Subject } from "@/lib/learn/types";

type Props = {
  materials: Material[];
  subjects: Subject[];
};

export function MaterialsListPane({ materials, subjects }: Props) {
  const router = useRouter();

  // 科目別 grouping (subjects の順序を維持、教材 0 件の科目はリストに出さない)
  const grouped = useMemo(() => {
    const map = new Map<string, Material[]>();
    for (const m of materials) {
      const arr = map.get(m.subjectId) ?? [];
      arr.push(m);
      map.set(m.subjectId, arr);
    }
    return subjects
      .map((s) => ({ subject: s, list: map.get(s.id) ?? [] }))
      .filter(({ list }) => list.length > 0);
  }, [materials, subjects]);

  const totalMaterials = materials.length;

  return (
    // 二層スクロールパターン (C41 で確立、WeeklyMonthlyReportView 由来)
    <div className="flex h-full w-full flex-col bg-canvas">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-5">
          <header className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <BookText className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">教材</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                登録済の教材 {totalMaterials} 件。クリックで体系図・評価コメント・先生 chat に飛べるよ。
              </p>
            </div>
          </header>

          {grouped.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <Book className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  まだ教材が登録されていません。
                </p>
                <p className="text-xs text-muted-foreground">
                  下の「+ 新規教材を追加」から始めよう。
                </p>
              </CardContent>
            </Card>
          ) : (
            grouped.map(({ subject, list }) => (
              <Card key={subject.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <SubjectTeacherAvatar
                      subjectId={subject.id}
                      size={24}
                      fallbackLetter={subject.teacher?.avatarLetter}
                    />
                    <span>{subject.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      ({list.length} 教材)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {list.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/tutor?view=material-detail&id=${encodeURIComponent(m.id)}`,
                        )
                      }
                      className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <Book className="size-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {m.name}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px]">
                            {m.label}
                          </Badge>
                          <Badge variant="outline" className="text-[9px]">
                            {m.gradeLevel}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            ))
          )}

          {/* 末尾「+ 新規教材を追加」リンク (SubjectPickerCard C29 / MaterialPickerCard C36 と同じパターン) */}
          <button
            type="button"
            onClick={() => router.push("/tutor?view=material-new")}
            className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
            title="新しい教材を登録 (教材登録ウィザードに遷移)"
          >
            <Plus className="size-4" />
            <span className="font-medium">新規教材を追加</span>
          </button>
        </div>
      </div>
    </div>
  );
}
