"use client";

/**
 * /admin/subjects — 科目の一括管理画面 (バックアップ動線)。
 *
 * 2026-05-25 grill 2 (科目追加設計) S6 確定:
 *   - 主動線: /tutor の「科目を追加」 → ゆいハブ → 右ペインに SubjectSettingsPanel embedded
 *   - バックアップ動線: 本ページ (/admin/subjects、URL バー直入力で到達可)
 *
 * 主動線と同じ SubjectSettingsPanel コンポーネントを再利用、useState で MOCK_SUBJECTS を
 * 動的管理。Phase 7 で Supabase クエリ + 永続化に置換予定。
 */
import { useState } from "react";
import {
  SubjectSettingsPanel,
  type NewSubjectInput,
} from "@/components/subjects/SubjectSettingsPanel";
import { MOCK_SUBJECTS } from "@/lib/learn/mock-data";
import type { Subject } from "@/lib/learn/types";

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>(MOCK_SUBJECTS);

  const handleAdd = (input: NewSubjectInput) => {
    const newSubject: Subject = {
      id: `subj-manual-${Date.now()}`,
      name: input.name,
      teacher: {
        name: input.teacherName,
        displayName: `${input.teacherName}先生`,
        avatarLetter: input.avatarLetter,
        subtitle: `${input.name}の先生`,
      },
    };
    setSubjects((prev) => [...prev, newSubject]);
    // mock-data 側にも push (主動線 /tutor からも見えるように)
    MOCK_SUBJECTS.push(newSubject);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold">科目の一括管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            親が学校シラバスを見ながら科目を一括設定するための画面 (バックアップ動線)。
            主動線は <code className="rounded bg-muted px-1 py-0.5 text-xs">/tutor</code> →
            ゆい「もっと ▼」→「科目を追加」、または計画立案フローの「+ 新規科目」リンクから。
          </p>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <SubjectSettingsPanel subjects={subjects} onSubjectAdded={handleAdd} />
      </div>
    </div>
  );
}
