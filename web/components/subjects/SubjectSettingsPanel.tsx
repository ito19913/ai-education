"use client";

/**
 * SubjectSettingsPanel - 科目の設定パネル。
 *
 * 2026-05-25 grill 2 (科目追加設計) C30 ガワ実装。
 *
 * - S6: ゆいハブから /tutor?view=subjects で展開される (主動線)
 *   /admin/subjects (C33 で実装) でも同コンポーネントを再利用予定 (バックアップ動線)
 * - S2: ハードコード 5 教科 (英・数・国・理・社) は「標準」バッジ、削除不可
 * - S3: それ以外は「手動追加」バッジ、追加フォームから新規登録可
 * - S7: 削除運用は実装時に詰める (本実装では UI 上の削除ボタンなし)
 *
 * MVP は in-memory mock (onSubjectAdded で TutorWorkspace の subjects state を更新、
 * リロードで消える)。Phase 7 で Supabase 永続化予定。
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SubjectTeacherAvatar } from "@/components/ui/subject-teacher-avatar";
import { Plus, Settings } from "lucide-react";
import type { Subject } from "@/lib/learn/types";

/** ハードコード 5 教科の ID (S2 + S9) */
const HARDCODED_SUBJECT_IDS = new Set([
  "subj-english",
  "subj-math",
  "subj-japanese",
  "subj-science",
  "subj-social",
]);

export type NewSubjectInput = {
  name: string;
  teacherName: string;
  avatarLetter: string;
};

type Props = {
  subjects: Subject[];
  /** 追加完了時に呼ばれる。TutorWorkspace 側で MOCK_SUBJECTS に push + ゆいに発話追加 */
  onSubjectAdded: (input: NewSubjectInput) => void;
};

export function SubjectSettingsPanel({ subjects, onSubjectAdded }: Props) {
  const [name, setName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [avatarLetter, setAvatarLetter] = useState("");

  const canSubmit =
    name.trim().length > 0 &&
    teacherName.trim().length > 0 &&
    avatarLetter.trim().length > 0;

  const handleAdd = () => {
    if (!canSubmit) return;
    onSubjectAdded({
      name: name.trim(),
      teacherName: teacherName.trim(),
      avatarLetter: avatarLetter.trim().charAt(0), // 1 文字のみ
    });
    setName("");
    setTeacherName("");
    setAvatarLetter("");
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto bg-canvas p-5">
      <header className="flex items-center gap-2">
        <Settings className="size-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">科目の設定</h1>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          登録済み科目 ({subjects.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {subjects.map((s) => {
            const isHardcoded = HARDCODED_SUBJECT_IDS.has(s.id);
            return (
              <li key={s.id}>
                <Card className="p-3">
                  <div className="flex items-center gap-3">
                    <SubjectTeacherAvatar
                      subjectId={s.id}
                      size={36}
                      fallbackLetter={s.teacher?.avatarLetter}
                      className="shrink-0"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.teacher?.displayName ?? `${s.name}の先生`}
                      </div>
                    </div>
                    {isHardcoded ? (
                      <Badge variant="secondary" className="shrink-0">
                        標準
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-amber-400 text-amber-700"
                      >
                        手動追加
                      </Badge>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          新しい科目を追加
        </h2>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-subject-name">科目名 *</Label>
              <Input
                id="new-subject-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 技術家庭"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-teacher-name">先生の名前 *</Label>
              <Input
                id="new-teacher-name"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="例: ひろし"
              />
              <p className="text-xs text-muted-foreground">
                表示は「○○先生」になります (例: ひろし先生)
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-avatar-letter">アバター文字 *</Label>
              <Input
                id="new-avatar-letter"
                value={avatarLetter}
                onChange={(e) =>
                  setAvatarLetter(e.target.value.slice(0, 1))
                }
                placeholder="ひ"
                maxLength={1}
                className="w-20 text-center text-lg"
              />
              <p className="text-xs text-muted-foreground">
                アバターに表示する 1 文字 (通常は名前の頭文字)
              </p>
            </div>
            <Button
              onClick={handleAdd}
              disabled={!canSubmit}
              className="mt-1 gap-2 self-end"
            >
              <Plus className="size-4" />
              <span>追加</span>
            </Button>
          </CardContent>
        </Card>
      </section>

      <p className="mt-auto text-xs text-muted-foreground">
        ※ ハードコード 5 教科 (英・数・国・理・社) は削除できません。
        手動追加した科目は次のフェーズで削除機能を実装予定 (2026-05-25 grill 2 S7)。
      </p>
    </div>
  );
}
