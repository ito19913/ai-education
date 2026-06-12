"use client";

/**
 * useLearningHistory — 学習履歴ドメインフック (Phase 3 モノリス分割、2026-06-12)
 *
 * TutorWorkspace から 学習履歴 (出来事ログ + 学習時間、2026-06-10 grill 確定) を
 * 抽出したもの。挙動は移設前と同一:
 * - 履歴は「自動・必須」。実アクションへのフックから記録される (タスク任意とは独立)
 * - 楽観更新 + real モードのみ裏で DB (失敗はログのみ、動線止めない)
 */

import { useCallback, useEffect, useState } from "react";
import type { LearningLog, StudyMinutesBucket } from "@/lib/learn/types";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import { formatLocalDate } from "@/lib/learn/session-storage";
import {
  fetchLearningLogs,
  insertLearningLog,
  fetchStudyMinutes,
  incrementStudyMinute,
  type NewLearningLogInput,
} from "@/lib/history/learning-logs-repo";

export function useLearningHistory() {
  const [learningLogs, setLearningLogs] = useState<LearningLog[]>([]);
  const [studyMinutes, setStudyMinutes] = useState<StudyMinutesBucket[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchLearningLogs()
      .then((rows) => {
        if (!cancelled) setLearningLogs(rows);
      })
      .catch((err) => console.error("[履歴] ログ取得失敗:", err));
    fetchStudyMinutes()
      .then((rows) => {
        if (!cancelled) setStudyMinutes(rows);
      })
      .catch((err) => console.error("[履歴] 学習時間取得失敗:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  /** 出来事を 1 件記録 (楽観更新 + 裏で DB)。"read" は同まとまり 1 日 1 回に丸める。 */
  const addLearningLog = useCallback(
    (input: NewLearningLogInput) => {
      if (input.kind === "read" && input.segmentId) {
        const todayKey = formatLocalDate(new Date());
        const dup = learningLogs.some(
          (l) =>
            l.kind === "read" &&
            l.segmentId === input.segmentId &&
            l.materialId === input.materialId &&
            formatLocalDate(new Date(l.createdAt)) === todayKey,
        );
        if (dup) return;
      }
      const local: LearningLog = {
        id: `log-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: input.kind,
        subjectId: input.subjectId,
        materialId: input.materialId,
        segmentId: input.segmentId,
        title: input.title,
        createdAt: new Date().toISOString(),
      };
      setLearningLogs((prev) => [local, ...prev]);
      if (isSupabaseConfigured()) {
        void (async () => {
          try {
            const ownerId = await getCurrentUserId();
            const created = await insertLearningLog(input, ownerId);
            setLearningLogs((prev) =>
              prev.map((l) => (l.id === local.id ? created : l)),
            );
          } catch (err) {
            console.error("[履歴] 記録失敗:", err);
          }
        })();
      }
    },
    [learningLogs],
  );

  /** 読書ビューのアクティブ 1 分ごとのハートビート (+1 分)。 */
  const handleStudyMinute = useCallback(
    (materialId: string, subjectId: string) => {
      const day = formatLocalDate(new Date());
      // 楽観更新 (バケットが無ければ作る)
      setStudyMinutes((prev) => {
        const idx = prev.findIndex(
          (b) => b.day === day && b.materialId === materialId,
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], minutes: next[idx].minutes + 1 };
          return next;
        }
        return [
          {
            id: `sm-local-${Date.now()}`,
            day,
            subjectId,
            materialId,
            minutes: 1,
          },
          ...prev,
        ];
      });
      if (isSupabaseConfigured()) {
        void (async () => {
          try {
            const ownerId = await getCurrentUserId();
            const bucket = await incrementStudyMinute(
              day,
              subjectId,
              materialId,
              ownerId,
            );
            // DB の真値で同期 (local 仮 id の行を置換)
            setStudyMinutes((prev) => {
              const others = prev.filter(
                (b) => !(b.day === day && b.materialId === materialId),
              );
              return [bucket, ...others];
            });
          } catch (err) {
            console.error("[履歴] 学習時間加算失敗:", err);
          }
        })();
      }
    },
    [],
  );

  return { learningLogs, studyMinutes, addLearningLog, handleStudyMinute };
}
