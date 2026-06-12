"use client";

/**
 * useSubjects — 科目ドメインフック (Phase 3 モノリス分割、2026-06-12)
 *
 * TutorWorkspace から科目 state (C30 grill 2 S7) + 永続化 (2026-06-07) を
 * 抽出したもの。挙動は移設前と同一:
 * - real は起動時 DB からカスタム科目を取得し、ハードコード 5 教科にマージ
 *   (id で dedupe、同一セッション中の追加→DB fetch の二重を防ぐ)
 * - 追加は real なら DB insert (DB 採番 id)、mock/失敗は in-memory フォールバック
 *   (リロードで消える割り切り)。mock は MOCK_SUBJECTS にも push して
 *   他画面 (admin 等) からも見えるようにする
 *
 * ゆい発話・navigate などの UI 副作用は呼び出し側 (TutorWorkspace) に残す。
 */

import { useCallback, useEffect, useState } from "react";
import type { Subject } from "@/lib/learn/types";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import {
  fetchCustomSubjects,
  insertSubject,
} from "@/lib/subjects/subjects-repo";
import { MOCK_SUBJECTS } from "@/lib/learn/mock-data";

export type SubjectAddInput = {
  name: string;
  teacherName: string;
  avatarLetter: string;
};

export function useSubjects(initialSubjects: Subject[]) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchCustomSubjects()
      .then((rows) => {
        if (cancelled) return;
        setSubjects((prev) => {
          const ids = new Set(prev.map((s) => s.id));
          const additions = rows.filter((s) => !ids.has(s.id));
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });
      })
      .catch((err) => console.error("[科目] 一覧取得失敗:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  /** 科目を追加して state に反映し、追加された Subject を返す。 */
  const addSubject = useCallback(
    async (input: SubjectAddInput): Promise<Subject> => {
      const buildLocal = (id: string): Subject => ({
        id,
        name: input.name,
        teacher: {
          name: input.teacherName,
          displayName: `${input.teacherName}先生`,
          avatarLetter: input.avatarLetter,
          subtitle: `${input.name}の先生`,
        },
      });

      let newSubject: Subject;
      if (isSupabaseConfigured()) {
        try {
          const ownerId = await getCurrentUserId();
          newSubject = await insertSubject(
            {
              name: input.name,
              teacherName: input.teacherName,
              avatarLetter: input.avatarLetter,
            },
            ownerId,
          );
        } catch (err) {
          console.error("[科目] 保存失敗、in-memory にフォールバック:", err);
          newSubject = buildLocal(`subj-manual-${Date.now()}`);
        }
      } else {
        newSubject = buildLocal(`subj-manual-${Date.now()}`);
        // mock-data 側にも push (admin/materials/new など他経路から見える)
        MOCK_SUBJECTS.push(newSubject);
      }

      setSubjects((prev) =>
        prev.some((s) => s.id === newSubject.id) ? prev : [...prev, newSubject],
      );
      return newSubject;
    },
    [],
  );

  return { subjects, addSubject };
}
