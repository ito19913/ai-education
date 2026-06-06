"use client";

/**
 * NoteGateDialog — まとめノート 能動ゲート (N9①+N9②、2026-06-05)
 *
 * grill N3: AI が「正しい要約」を提示 → 子が自分の言葉で説明 → 通過で刻む。
 * grill N9② Q2/Q4: AI は判定＋提案、最終の理解済み/open は本人決定 (安全側のみ:
 * 通過→open は可 / 不通過→理解済みは不可 = 関所維持)。
 *
 * 2 モード:
 * - create (読書ビューから): ページ画像 → 要約生成 → 説明 → understood/open で新規作成
 * - review (ノートの open カードから): 要約は既存 → 説明だけ → 通過で昇格 (status update)
 */

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  BookOpenCheck,
  Sparkles,
  PenLine,
  CircleDashed,
} from "lucide-react";
import { MarkdownText } from "@/components/chat/MarkdownText";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import {
  summarizeConceptForNote,
  judgeExplanation,
} from "@/lib/notes/note-gate-claude";
import { insertNoteEntry, getCurrentUserId } from "@/lib/notes/notes-repo";
import type { AokiChatMessage } from "@/lib/admin/aoki-chat-claude";
import type {
  AiExtractedNode,
  ConceptSegment,
  NoteEntry,
} from "@/lib/learn/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** create = 読書ビューから新規 / review = open エントリの振り返り昇格 */
  mode: "create" | "review";

  // --- create モード ---
  materialId?: string;
  materialName?: string;
  subjectId?: string;
  subjectName?: string;
  gradeLevel?: string;
  pageNumber?: number;
  /** 親が描画した現在ページ画像 (base64 JPEG、改行連結) */
  pageImagesPacked?: string;
  /** findConceptForPage の結果 (概念ヒント + 出典ページ範囲、まとまりが無い時のレガシー) */
  currentConcept?: AiExtractedNode | null;
  /** まとまり (一単元=1概念) 区切り (M1)。あれば概念名ヒント + sourceSegmentId に使う。 */
  segment?: ConceptSegment | null;
  /** ここまでの葵 chat 対話 (要約に反映、grill Q2) */
  dialogue?: AokiChatMessage[];
  /** create: 通過してノートに刻めたエントリを親に渡す */
  onCommitted?: (entry: NoteEntry) => void;

  // --- review モード ---
  /** review: 既存の open エントリ (要約は既存、説明だけ再ゲート) */
  existingEntry?: NoteEntry;
  /** review: 理解済みに昇格した時 (親が status を update) */
  onUpgraded?: (id: string) => void;
};

type Stage =
  | "summarizing"
  | "review" // create: 要約確認 + メモ + 説明する/openで残す の分岐
  | "explain"
  | "judging"
  | "judged-pass"
  | "judged-fail"
  | "done";

type Outcome = "understood" | "open" | "upgraded";

const useClaude = process.env.NEXT_PUBLIC_USE_CLAUDE_API === "true";

export function NoteGateDialog(props: Props) {
  const {
    open,
    onOpenChange,
    mode,
    materialId,
    materialName,
    subjectId,
    subjectName,
    gradeLevel,
    pageNumber,
    pageImagesPacked,
    currentConcept,
    segment,
    dialogue,
    onCommitted,
    existingEntry,
    onUpgraded,
  } = props;

  const [stage, setStage] = useState<Stage>("summarizing");
  const [conceptName, setConceptName] = useState("");
  const [summary, setSummary] = useState("");
  const [memo, setMemo] = useState("");
  const [explanation, setExplanation] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("understood");

  // 出典の表示用ページ範囲。まとまりがあれば印刷ページヒント (人間表示用、M3) を優先。
  const sourcePageRange =
    segment?.printPageHint ??
    currentConcept?.pageRange ??
    (pageNumber ? `p.${pageNumber}` : undefined);
  // 概念名のヒント (まとまり優先)。
  const conceptHint = segment?.conceptName ?? currentConcept?.name ?? null;

  // ----- 開いた時の初期化 -----
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExplanation("");
    setMemo("");
    setFeedback(null);
    setErrorMsg(null);

    if (mode === "review" && existingEntry) {
      // review: 要約は既存。すぐ説明へ (昇格のみ、メモ取り込みは create 限定)。
      setConceptName(existingEntry.conceptName);
      setSummary(existingEntry.aiSummary);
      setStage("explain");
      return;
    }

    // create: ページを vision で読んで要約を作る。
    setStage("summarizing");
    setConceptName(conceptHint ?? "");
    setSummary("");
    (async () => {
      try {
        if (!useClaude) {
          if (cancelled) return;
          setConceptName(conceptHint ?? "この論点");
          setSummary(
            currentConcept?.description ??
              "（AI 要約は Claude 有効時に生成されます。今は仮の要約です）",
          );
          setStage("review");
          return;
        }
        const out = await summarizeConceptForNote({
          materialName: materialName ?? "教材",
          subjectName: subjectName ?? "教科",
          gradeLevel: gradeLevel ?? "中2",
          currentConceptName: conceptHint,
          pageImagesPacked,
          pageNumber,
          dialogue: dialogue?.map((m) => ({ role: m.role, text: m.text })),
        });
        if (cancelled) return;
        setConceptName(out.conceptName);
        setSummary(out.summary);
        setStage("review");
      } catch (err) {
        console.error("[ノート] 要約生成失敗:", err);
        if (cancelled) return;
        setConceptName(conceptHint ?? "この論点");
        setSummary(
          currentConcept?.description ??
            "（要約をうまく作れませんでした。ページを見ながら自分で要点を説明してみよう）",
        );
        setStage("review");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    mode,
    existingEntry,
    materialName,
    subjectName,
    gradeLevel,
    pageNumber,
    pageImagesPacked,
    currentConcept,
    conceptHint,
    dialogue,
  ]);

  // ----- 最終確定 (本人の決定で understood / open) -----
  const finalize = useCallback(
    async (status: "understood" | "open") => {
      if (mode === "review" && existingEntry) {
        if (status === "understood") {
          onUpgraded?.(existingEntry.id);
          setOutcome("upgraded");
          setStage("done");
        } else {
          // open のまま = 変更なし、閉じるだけ
          onOpenChange(false);
        }
        return;
      }

      // create: 新規エントリを刻む (real は DB、mock は in-memory)
      const trimmedMemo = memo.trim() || undefined;
      try {
        if (isSupabaseConfigured()) {
          const ownerId = await getCurrentUserId();
          const entry = await insertNoteEntry(
            {
              subjectId: subjectId ?? "subj-english",
              conceptName,
              aiSummary: summary,
              status,
              sourceMaterialId: materialId,
              sourcePageRange,
              sourceSegmentId: segment?.id,
              userNote: trimmedMemo,
            },
            ownerId,
          );
          onCommitted?.(entry);
          setOutcome(status);
          setStage("done");
          return;
        }
      } catch (err) {
        console.error("[ノート] 保存失敗、in-memory にフォールバック:", err);
      }
      onCommitted?.({
        id: `note-local-${Date.now()}`,
        subjectId: subjectId ?? "subj-english",
        conceptName,
        aiSummary: summary,
        status,
        sourceMaterialId: materialId,
        sourcePageRange,
        sourceSegmentId: segment?.id,
        userNote: trimmedMemo,
      });
      setOutcome(status);
      setStage("done");
    },
    [
      mode,
      existingEntry,
      onUpgraded,
      onOpenChange,
      subjectId,
      conceptName,
      summary,
      memo,
      materialId,
      sourcePageRange,
      segment,
      onCommitted,
    ],
  );

  // ----- 説明を判定 -----
  const handleJudge = useCallback(async () => {
    const text = explanation.trim();
    if (text.length === 0) return;
    setStage("judging");
    setFeedback(null);
    setErrorMsg(null);
    try {
      let passed: boolean;
      let fb: string;
      if (!useClaude) {
        passed = text.length >= 10;
        fb = passed
          ? "いい説明だね！（mock 判定）"
          : "もう少し自分の言葉で説明してみよう。（mock 判定）";
      } else {
        const out = await judgeExplanation({
          conceptName,
          aiSummary: summary,
          explanation: text,
        });
        passed = out.passed;
        fb = out.feedback;
      }
      setFeedback(fb);
      setStage(passed ? "judged-pass" : "judged-fail");
    } catch (err) {
      console.error("[ノート] 判定失敗:", err);
      setErrorMsg("判定でエラーが出ました。もう一度試してね。");
      setStage("explain");
    }
  }, [explanation, conceptName, summary]);

  const isReview = mode === "review";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="size-5 text-primary" />
            {isReview ? "もう一回、説明してみる" : "ノートにまとめる"}
          </DialogTitle>
          <DialogDescription>
            {isReview
              ? `前に「まだ」だった「${conceptName}」。自分の言葉で説明できたら理解済みにできるよ。`
              : `${materialName ?? "教材"}${sourcePageRange ? `（${sourcePageRange}）` : ""} から、理解できたら自分のノートに刻むよ。`}
          </DialogDescription>
        </DialogHeader>

        {stage === "summarizing" ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>葵先生が今のページを読んで、要点を整理しています…</span>
          </div>
        ) : stage === "done" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            {outcome === "open" ? (
              <CircleDashed className="size-10 text-amber-500" />
            ) : (
              <BookOpenCheck className="size-10 text-primary" />
            )}
            <p className="text-sm font-medium">
              {outcome === "understood"
                ? "ノートに刻んだよ ✍️（理解済み）"
                : outcome === "upgraded"
                  ? "理解済みにしたよ ✍️"
                  : "「振り返りたい」として残したよ"}
            </p>
            {feedback && (
              <p className="text-sm text-muted-foreground">{feedback}</p>
            )}
            <Button className="mt-2" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
          </div>
        ) : stage === "review" ? (
          /* create: 要約確認 + メモ取り込み + 説明する/openで残す の分岐 */
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5" />
                葵先生がこう整理したよ — 「{conceptName}」
              </div>
              <div className="text-sm">
                <MarkdownText text={summary} />
              </div>
            </div>

            {/* メモ取り込み (Q2: 葵が「メモしたいことある?」と聞く → 自分メモ欄へ) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                ここで覚えておきたい・自分用にメモしたいことある?（任意）
              </label>
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="例: 不定詞と動名詞の使い分けが自分は混乱しがち、など"
                className="min-h-[60px] resize-none"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => void finalize("open")}
              >
                今は説明せず、振り返りに残す
              </Button>
              <Button onClick={() => setStage("explain")}>
                説明して理解済みにする
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* AI 要約 (本体、書き換えさせない) */}
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5" />
                葵先生がこう整理したよ — 「{conceptName}」
              </div>
              <div className="text-sm">
                <MarkdownText text={summary} />
              </div>
            </div>

            {/* 説明 (能動ゲート) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                自分の言葉で説明してみて
              </label>
              <p className="text-xs text-muted-foreground">
                「分かった」だけじゃなく、要点を自分の言葉で言えたら理解済みにできるよ。
              </p>
              <Textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="例: 不定詞の名詞的用法は、to + 動詞で「〜すること」という意味になって…"
                className="min-h-[96px] resize-none"
                disabled={stage === "judging"}
              />
              {errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
            </div>

            {/* 判定結果のフィードバック */}
            {(stage === "judged-pass" || stage === "judged-fail") &&
              feedback && (
                <div
                  className={
                    stage === "judged-pass"
                      ? "rounded-md bg-emerald-50 p-2.5 text-sm text-emerald-800"
                      : "rounded-md bg-amber-50 p-2.5 text-sm text-amber-800"
                  }
                >
                  {feedback}
                </div>
              )}

            {/* 操作ボタン: stage で出し分け */}
            <div className="flex flex-wrap justify-end gap-2">
              {stage === "explain" || stage === "judging" ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => void finalize("open")}
                    disabled={stage === "judging"}
                  >
                    まだ分からない、残す
                  </Button>
                  <Button
                    onClick={() => void handleJudge()}
                    disabled={
                      stage === "judging" || explanation.trim().length === 0
                    }
                    className="gap-2"
                  >
                    {stage === "judging" ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>確認中…</span>
                      </>
                    ) : (
                      <span>説明できた、確認する</span>
                    )}
                  </Button>
                </>
              ) : stage === "judged-pass" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => void finalize("open")}
                  >
                    まだ不安、残す
                  </Button>
                  <Button onClick={() => void finalize("understood")}>
                    {isReview ? "理解済みにする" : "理解済みで刻む"}
                  </Button>
                </>
              ) : (
                /* judged-fail */
                <>
                  <Button
                    variant="outline"
                    onClick={() => setStage("explain")}
                  >
                    もう一回説明する
                  </Button>
                  <Button variant="ghost" onClick={() => void finalize("open")}>
                    {isReview ? "open のままにする" : "残して、また振り返る"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
