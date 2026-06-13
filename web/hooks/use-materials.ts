"use client";

/**
 * useMaterials — 教材 (本 + 宿題・テスト) ドメインフック
 * (Phase 3 モノリス分割、2026-06-12)
 *
 * TutorWorkspace から教材 state + DB 復元 + 編集/サムネ/ガイドプラン書き戻し +
 * 宿題・テスト CRUD + 登録フロー (runPdfBackgroundWork) を抽出したもの。
 * 挙動は移設前と同一。
 *
 * UI 副作用 (ゆい発話・navigate) と他ドメイン連鎖 (プラン/pick の連鎖掃除、
 * 学習履歴、pick 完了観測) は呼び出し側 (TutorWorkspace) に残す:
 * - 削除 = removeMaterial が教材ドメイン部分だけやって削除済み Material を返す
 * - 宿題状態 = setAssignmentStatus が state + DB 部分だけやる
 * - 登録 = handleMaterialAdded が発話/遷移を呼び出し時コールバックで受け取る
 *   (フック構築時ではなく呼び出し時に渡すので、tutorMessages/navigate が
 *   このフックより後に宣言されていても循環しない)
 */

import { useCallback, useEffect, useState } from "react";
import type {
  AssignmentStatus,
  ConceptSegment,
  GuidedBlock,
  Material,
  Subject,
  TutorMessage,
} from "@/lib/learn/types";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import {
  fetchMaterials,
  insertMaterial,
  updateMaterialPdfPath,
  updateMaterialSegments,
  updateMaterialSegmentStatus,
  updateMaterialMeta,
  updateMaterialCoverThumb,
  softDeleteMaterial,
  insertAssignment,
  updateAssignment,
  updateAssignmentStatus,
  getCurrentUserId,
  type NewAssignmentInput,
} from "@/lib/materials/materials-repo";
import { isSegmentJobsEnabled } from "@/lib/materials/is-segment-jobs-enabled";
import { enqueueSegmentationJob } from "@/lib/materials/segmentation-jobs-repo";
import {
  extractFullPageTextsFromDoc,
  loadPdfDocument,
  renderCoverThumb,
  type LoadedPdf,
} from "@/lib/pdf/pdf-extract-text";
import { segmentConceptsFromText } from "@/lib/ai/segment-claude";
import { buildScanSegments } from "@/lib/ai/scan-segment-builder";
import {
  uploadMaterialPdf,
  removeMaterialPdf,
} from "@/lib/materials/pdf-storage";
import { setSessionPdf } from "@/lib/pdf/session-pdf-store";
import { MOCK_MATERIALS } from "@/lib/learn/mock-data";

/** handleMaterialAdded が受け取る UI 副作用 (TutorWorkspace 側で実装)。 */
export type MaterialAddedUiHooks = {
  /** ゆいの発話を chat に追加する。 */
  pushTutorMessage: (message: TutorMessage) => void;
  /** 「葵が読んだよ」発話の直後に教材詳細へ遷移する。 */
  onRegistered: (material: Material) => void;
};

export function useMaterials(subjects: Subject[]) {
  // C46 2026-05-26 F (ito19 さん意見): 教材編集・削除のため materials を state 管理。
  // 段階1-B (2026-06-05): real モード (Supabase 設定済) は起動時 DB fetch で復元、
  // mock モードは MOCK_MATERIALS をフォールバック表示 (リロードで消える割り切り)。
  // RightPaneRouter 経由で MaterialsListPane / MaterialDetailView に最新 state を流す。
  const [materials, setMaterials] = useState<Material[]>(
    isSupabaseConfigured() ? [] : MOCK_MATERIALS,
  );
  // Phase B: 「今日なにやる?」候補カードを出すのは初期 fetch 完了後 (空データで
  // 候補 0 件と誤判定しないため)。mock モードは即 true。
  const [materialsLoaded, setMaterialsLoaded] = useState(
    !isSupabaseConfigured(),
  );
  // 嘘の空状態を出さない (2026-06-12 レビュー指摘): fetch 失敗を空 (= 「まだ登録されて
  // いません」) と区別する。データはあるのに「無い」と断言すると子は「消えた!」と混乱する。
  const [materialsError, setMaterialsError] = useState(false);

  // 段階1-B: real モードでは起動時に DB から教材一覧を取得して復元する。
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchMaterials()
      .then((rows) => {
        if (!cancelled) setMaterials(rows);
      })
      .catch((err) => {
        console.error("[教材] 一覧取得失敗:", err);
        if (!cancelled) setMaterialsError(true);
      })
      .finally(() => {
        if (!cancelled) setMaterialsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 教材データの表示状態 (一覧・ダッシュボードの空状態を 3 値で出し分ける)。
  const materialsLoadState: "loading" | "error" | "ready" = materialsError
    ? "error"
    : materialsLoaded
      ? "ready"
      : "loading";

  /**
   * 教材一覧を取り直す (2026-06-13、まとまり生成ジョブ化)。
   * 画面遷移 (本棚に戻る / 読書ビューを開く) のたびに呼び、サーバージョブが更新した
   * segment_status / concept_segments を反映する (Realtime は使わず遷移時 fetch、grill 確定)。
   * loaded フラグは触らない (ちらつき防止、成功時だけ差し替え)。
   */
  const refetchMaterials = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const rows = await fetchMaterials();
      setMaterials(rows);
    } catch (err) {
      console.error("[教材] 再取得失敗:", err);
    }
  }, []);

  // ----- 教材編集 (C46 F、ito19 さん意見): メタ情報 patch を materials state に反映 -----
  const handleMaterialUpdated = useCallback(
    (id: string, patch: Partial<Material>) => {
      setMaterials((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
      // real モード: メタ編集 (名前/出版社/著者/種別/学年/科目) を DB に永続化。
      // これまで in-memory のみでリロードすると編集が消えていた (潜在バグ) のを是正。
      if (isSupabaseConfigured()) {
        void updateMaterialMeta(id, {
          name: patch.name,
          subjectId: patch.subjectId,
          label: patch.label,
          publisher: patch.publisher,
          author: patch.author,
          gradeLevel: patch.gradeLevel,
        }).catch((err) =>
          console.error("[教材] メタ編集の永続化に失敗:", err),
        );
      }
    },
    [],
  );

  // ----- 表紙サムネ (2026-06-08): PDF を読んだ時に生成された data URL を反映 + 永続化 -----
  // 登録時 / 読書ビューを開いた時に 1 回だけ生成し、materials state + DB に保存する。
  const handleCoverThumb = useCallback((id: string, dataUrl: string) => {
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === id && !m.coverThumb ? { ...m, coverThumb: dataUrl } : m,
      ),
    );
    if (isSupabaseConfigured()) {
      void updateMaterialCoverThumb(id, dataUrl).catch((err) =>
        console.error("[教材] 表紙サムネの永続化に失敗:", err),
      );
    }
  }, []);

  // ガイドプラン保存の親 state 書き戻し (2026-06-12 レビュー指摘の修正)。
  // MaterialReadPane の guidedPlansMap はマウント時の material.guidedPlans から
  // 初期化されるため、ここで materials を更新しないと次回マウントが古い map になり、
  // 別まとまりの保存が他まとまりのプラン・青枠調整を DB から消す (stale 全置換)。
  // DB への保存は MaterialReadPane 側 (persistGuidedPlans) が担当、ここは state のみ。
  const handleGuidedPlansSaved = useCallback(
    (materialId: string, plans: Record<string, GuidedBlock[]>) => {
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === materialId ? { ...m, guidedPlans: plans } : m,
        ),
      );
    },
    [],
  );

  /**
   * 教材削除のドメイン部分: state から外し、real は行を論理削除 + PDF 実体を
   * Storage から消す (コスト優先)。削除した Material を返す (ゆい発話の文言用)。
   * プラン/pick の連鎖掃除・発話・遷移は呼び出し側 (handleMaterialDeleted)。
   */
  const removeMaterial = useCallback(
    (id: string): Material | undefined => {
      const deleted = materials.find((m) => m.id === id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      if (isSupabaseConfigured()) {
        void softDeleteMaterial(id).catch((err) =>
          console.error("[教材] 論理削除失敗:", err),
        );
        if (deleted?.pdfPath) {
          void removeMaterialPdf(deleted.pdfPath).catch((err) =>
            console.error("[教材] PDF 実体削除失敗:", err),
          );
        }
      }
      return deleted;
    },
    [materials],
  );

  /**
   * 「区切り直す」(2026-06-13、まとまり生成ジョブ化): ready/failed 含む全状態で再キュー。
   * ★古い concept_segments はそのまま残す★ (再区切り中も使えるまま、完走時にワーカーが
   * 原子差し替え)。状態だけ queued にして本棚バッジを「準備中」にする。
   */
  const resegmentMaterial = useCallback(
    async (materialId: string) => {
      if (!isSegmentJobsEnabled() || !isSupabaseConfigured()) return;
      const target = materials.find((m) => m.id === materialId);
      if (!target?.pdfPath) return; // PDF が無いと区切れない
      try {
        const ownerId = await getCurrentUserId();
        await enqueueSegmentationJob(materialId, ownerId);
        await updateMaterialSegmentStatus(materialId, "queued");
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === materialId ? { ...m, segmentStatus: "queued" } : m,
          ),
        );
      } catch (err) {
        console.error("[まとまり] 区切り直し失敗:", err);
      }
    },
    [materials],
  );

  // ----- 宿題・テスト (kind="assignment"、2026-06-09) -----
  // 問題 PDF を Storage にアップして紐付ける共通処理 (新規/差し替え両用)。
  const uploadAssignmentPdf = useCallback(
    async (id: string, ownerId: string, pdfFile: File) => {
      try {
        const { path, size } = await uploadMaterialPdf(ownerId, id, pdfFile);
        await updateMaterialPdfPath(id, path, size);
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, pdfPath: path, pdfSize: size } : m,
          ),
        );
      } catch (e) {
        console.error("[宿題・テスト] PDF アップロード失敗:", e);
      }
    },
    [],
  );

  // 追加 or 編集 (id があれば編集)。PDF があれば一緒にアップ/差し替え。
  // Phase B 拡張: 新規作成時は作成 Material を返す (儀式中の「登録→今日の枠に自動 pick」用)。
  const handleSubmitAssignment = useCallback(
    async (
      input: NewAssignmentInput,
      pdfFile?: File,
      id?: string,
    ): Promise<Material | null> => {
      // ----- 編集 -----
      if (id) {
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  name: input.name,
                  subjectId: input.subjectId,
                  assignmentType: input.assignmentType,
                  dueDate: input.dueDate,
                }
              : m,
          ),
        );
        if (isSupabaseConfigured()) {
          try {
            await updateAssignment(id, input);
          } catch (err) {
            console.error("[宿題・テスト] 更新失敗:", err);
          }
          if (pdfFile) {
            const ownerId = await getCurrentUserId();
            await uploadAssignmentPdf(id, ownerId, pdfFile);
          }
        }
        return null;
      }
      // ----- 新規 -----
      if (isSupabaseConfigured()) {
        try {
          const ownerId = await getCurrentUserId();
          const created = await insertAssignment(input, ownerId);
          setMaterials((prev) => [...prev, created]);
          // assignment なので まとまり/体系図 等の重い処理はしない。
          if (pdfFile) {
            await uploadAssignmentPdf(created.id, ownerId, pdfFile);
          }
          return created;
        } catch (err) {
          console.error("[宿題・テスト] 追加失敗、in-memory にフォールバック:", err);
        }
      }
      const local: Material = {
        id: `assignment-local-${Date.now()}`,
        subjectId: input.subjectId,
        name: input.name,
        label: "テキスト",
        coveredNodeIds: [],
        kind: "assignment",
        assignmentType: input.assignmentType,
        dueDate: input.dueDate,
        assignmentStatus: "todo",
      };
      setMaterials((prev) => [...prev, local]);
      return local;
    },
    [uploadAssignmentPdf],
  );

  const handleDeleteAssignment = useCallback(
    (id: string) => {
      const target = materials.find((m) => m.id === id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      if (isSupabaseConfigured()) {
        void softDeleteMaterial(id).catch((err) =>
          console.error("[宿題・テスト] 削除失敗:", err),
        );
        if (target?.pdfPath) {
          void removeMaterialPdf(target.pdfPath).catch((err) =>
            console.error("[宿題・テスト] PDF 実体削除失敗:", err),
          );
        }
      }
    },
    [materials],
  );

  /**
   * 宿題状態更新のドメイン部分 (state + DB)。学習履歴・pick 完了観測は
   * 呼び出し側 (handleToggleAssignmentStatus)。
   */
  const setAssignmentStatus = useCallback(
    (id: string, status: AssignmentStatus) => {
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, assignmentStatus: status } : m,
        ),
      );
      if (isSupabaseConfigured()) {
        void updateAssignmentStatus(id, status).catch((err) =>
          console.error("[宿題・テスト] 状態更新失敗:", err),
        );
      }
    },
    [],
  );

  // ----- 教材追加完了時: materials state に push + ゆい発話 + 新教材の詳細へ遷移 -----
  // C32 2026-05-25 grill 1 確定 13: アップ完了動線 = ゆいから「葵が読んだよ、見る?」
  // → 右ペインに material-detail (体系図 + 評価コメント + 葵 chat) 即時展開
  // 2026-06-04 (残課題② 解消): Step4Save が構築した Material を in-memory で materials に追加。
  // これで一覧 (MaterialsListPane) にも詳細にも登録した教材が出る。Phase 7 で永続化に置換。
  const handleMaterialAdded = useCallback(
    (
      material: Material,
      approvedNodeCount: number,
      file: File | null | undefined,
      ui: MaterialAddedUiHooks,
    ) => {
      // まとまり (一単元=1概念) 区切り (M1-M10、2026-06-06 / C-8 スキャン本対応)。
      // 登録後バックグラウンドで全書を読み、概念単位に区切る:
      //   - デジタル PDF (文字レイヤーあり) → 本文テキストで区切る (segmentConceptsFromText)
      //   - スキャン PDF (文字レイヤー無し)   → C-8 経路 (buildScanSegments、目次土台 + vision)
      // 結果は materials state に反映 (+ real モードは DB 保存) + ゆいが「区切れたよ」と通知。
      // これで「開いた時に待つ」のではなく「アップロード時に裏で作っておく」状態になる。
      // Phase 2 メモリ対策 (2026-06-12): 旧実装は 表紙サムネ / テキスト抽出 / スキャン区切り が
      // それぞれ loadPdfDocument して同じ PDF を並行 3 回ロードしていた (186MB 自炊本で
      // ピーク ~560MB)。1 回だけロードして共有し、軽い順 (サムネ→区切り) に直列実行する。
      // フラグ ON かつ real モードのみサーバージョブで生成する (mock はワーカーが無い)。
      const useJobs = isSegmentJobsEnabled() && isSupabaseConfigured();
      const runPdfBackgroundWork = (m: Material, persist: boolean) => {
        if (!file) return;
        const subjectName =
          subjects.find((s) => s.id === m.subjectId)?.name ?? "教科";
        void (async () => {
          let loadedPdf: LoadedPdf;
          try {
            loadedPdf = await loadPdfDocument(file);
          } catch (err) {
            console.error("[教材] PDF ロード失敗 (動線は止めない):", err);
            return;
          }
          try {
            // 1) 表紙サムネ (2026-06-08): 1 ページ目を小さく描画して一覧用に保存。
            //    軽いので先に終わらせる。失敗しても区切りには進む。
            try {
              const thumb = await renderCoverThumb(loadedPdf.doc);
              if (thumb) {
                // mock では state 反映のみ、real では DB 保存も (handleCoverThumb 内で分岐)。
                if (persist) handleCoverThumb(m.id, thumb);
                else
                  setMaterials((prev) =>
                    prev.map((x) =>
                      x.id === m.id && !x.coverThumb
                        ? { ...x, coverThumb: thumb }
                        : x,
                    ),
                  );
              }
            } catch (err) {
              console.error("[教材] 表紙サムネ生成失敗 (動線は止めない):", err);
            }

            // 2) まとまり区切り (M1-M10 / C-8)
            // フラグ ON 時はサーバージョブが区切るので、ブラウザでは生成しない (表紙サムネだけ)。
            if (useJobs) return;
            try {
              const { hasTextLayer, packedText } =
                await extractFullPageTextsFromDoc(loadedPdf.doc);
              let segments: ConceptSegment[];
              if (hasTextLayer && packedText.length > 0) {
                // デジタル PDF: 本文テキストから PDF 紙番号で直接区切る (M3)。
                segments = await segmentConceptsFromText({
                  materialName: m.name,
                  subjectName,
                  gradeLevel: m.gradeLevel ?? "中2",
                  packedText,
                });
              } else {
                // スキャン PDF: C-8 ハイブリッド (目次土台 + オフセット較正) or 全ページ vision。
                segments = await buildScanSegments(loadedPdf.doc, m, subjectName);
              }
              if (segments.length === 0) return;
              setMaterials((prev) =>
                prev.map((x) =>
                  x.id === m.id ? { ...x, conceptSegments: segments } : x,
                ),
              );
              if (persist) {
                try {
                  await updateMaterialSegments(m.id, segments);
                } catch (err) {
                  console.error("[まとまり] セグメント保存失敗:", err);
                }
              }
              ui.pushTutorMessage({
                id: `t-mat-seg-${Date.now()}`,
                role: "tutor",
                text: `「${m.name}」を ${segments.length} 個のまとまり (一単元) に区切ったよ✂️\n「一緒に読む」を開くと、葵先生が「今日はここからここまで」と単元ごとに案内してくれるよ。`,
                createdAt: new Date().toISOString(),
              });
            } catch (err) {
              console.error("[まとまり] 区切り失敗 (動線は止めない):", err);
            }
          } finally {
            void loadedPdf.destroy();
          }
        })();
      };

      // 一覧/詳細/体系図への反映 + ゆいの「葵が読んだよ」発話 + 詳細へ遷移 (共通)。
      const announceAndShow = (m: Material) => {
        setMaterials((prev) => [...prev, m]);
        // 段階1-C/1-B: 読書ビューが任意ページを即描画できるよう PDF を L1 キャッシュ。
        if (file) setSessionPdf(m.id, file);
        ui.pushTutorMessage({
          id: `t-mat-${Date.now()}`,
          role: "tutor",
          text: `「${m.name}」、葵先生が読んだよ！\n体系図 (${approvedNodeCount} ノード) と評価コメントをまとめてくれたから、右で見せるね。`,
          createdAt: new Date().toISOString(),
        });
        ui.onRegistered(m);
      };

      // mock モード: 従来通り in-memory push のみ (リロードで消える)。
      if (!isSupabaseConfigured()) {
        announceAndShow(material);
        runPdfBackgroundWork(material, false);
        return;
      }

      // 段階1-B real モード: 行は即作成 (一覧/体系図は即表示)、PDF は裏でアップロード。
      void (async () => {
        try {
          const ownerId = await getCurrentUserId();
          const saved = await insertMaterial(
            {
              subjectId: material.subjectId,
              name: material.name,
              label: material.label,
              publisher: material.publisher,
              author: material.author,
              gradeLevel: material.gradeLevel,
              coveredNodeIds: material.coveredNodeIds,
              extractedNodes: material.extractedNodes,
            },
            ownerId,
          );
          announceAndShow(saved);
          // 表紙サムネ + まとまり区切りを裏で実行 (DB 保存あり、PDF は 1 回だけロードして共有)。
          // PDF アップロード (TUS、チャンク読み) とは並走してよい。
          runPdfBackgroundWork(saved, true);

          // PDF を裏でアップロード (await しない)。完了で pdf_path を記録 + 完了通知。
          if (file) {
            uploadMaterialPdf(ownerId, saved.id, file)
              .then(async ({ path, size }) => {
                await updateMaterialPdfPath(saved.id, path, size);
                setMaterials((prev) =>
                  prev.map((m) =>
                    m.id === saved.id
                      ? { ...m, pdfPath: path, pdfSize: size }
                      : m,
                  ),
                );
                // フラグ ON: PDF が Storage に乗ったのでサーバージョブを enqueue
                // (ワーカーが Storage から落として区切る)。状態は「準備中」に。
                if (useJobs) {
                  try {
                    await enqueueSegmentationJob(saved.id, ownerId);
                    await updateMaterialSegmentStatus(saved.id, "queued");
                    setMaterials((prev) =>
                      prev.map((m) =>
                        m.id === saved.id
                          ? { ...m, segmentStatus: "queued" }
                          : m,
                      ),
                    );
                  } catch (err) {
                    console.error("[まとまり] ジョブ登録失敗:", err);
                  }
                }
                ui.pushTutorMessage({
                  id: `t-mat-up-${Date.now()}`,
                  role: "tutor",
                  text: useJobs
                    ? `「${saved.name}」の PDF を保存したよ📚\n今、葵先生がまとまり (一単元) に区切ってるからちょっと待っててね。本棚で「準備中」が消えたら一緒に読めるよ。`
                    : `「${saved.name}」の PDF も保存できたよ📚\nこれで次に開いた時も、リロードしても一緒に読めるよ。`,
                  createdAt: new Date().toISOString(),
                });
              })
              .catch((err) => {
                console.error("[教材] PDF アップロード失敗:", err);
                ui.pushTutorMessage({
                  id: `t-mat-uperr-${Date.now()}`,
                  role: "tutor",
                  text: `ごめん、「${saved.name}」の PDF 保存が途中で止まっちゃった💦\n教材は登録できてるよ。今のセッション中は読めるけど、リロード後にもう一度開けない時は登録し直してね。`,
                  createdAt: new Date().toISOString(),
                });
              });
          }
        } catch (err) {
          console.error("[教材] 保存失敗、in-memory にフォールバック:", err);
          // DB 保存に失敗してもUXを止めない: in-memory で見せる (リロードで消える)。
          announceAndShow(material);
          runPdfBackgroundWork(material, false);
        }
      })();
    },
    [subjects, handleCoverThumb],
  );

  return {
    materials,
    materialsLoaded,
    materialsLoadState,
    handleMaterialUpdated,
    handleCoverThumb,
    handleGuidedPlansSaved,
    removeMaterial,
    handleSubmitAssignment,
    handleDeleteAssignment,
    setAssignmentStatus,
    handleMaterialAdded,
    refetchMaterials,
    resegmentMaterial,
  };
}
