"use client";

/**
 * NoteGateDialog — まとめノート 能動ゲート (N9① MVP、2026-06-05)
 *
 * grill N3: AI が「正しい要約」を提示 → 子が自分の言葉で説明 → 通過して初めて
 * ノートに刻む (受け身の「はい」では刻まない)。読書ビュー (MaterialReadPane) の
 * 「ここをノートにまとめる」から、現在ページ画像 + 概念ヒントを受けて起動する。
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
import { Loader2, BookOpenCheck, Sparkles, PenLine } from "lucide-react";
import { MarkdownText } from "@/components/chat/MarkdownText";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import {
  summarizeConceptForNote,
  judgeExplanation,
} from "@/lib/notes/note-gate-claude";
import {
  insertNoteEntry,
  getCurrentUserId,
} from "@/lib/notes/notes-repo";
import type { AiExtractedNode, NoteEntry } from "@/lib/learn/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialId: string;
  materialName: string;
  subjectId: string;
  subjectName: string;
  gradeLevel: string;
  pageNumber: number;
  /** 親が描画した現在ページ画像 (base64 JPEG、改行連結、aoki-chat と同形式) */
  pageImagesPacked: string;
  /** findConceptForPage の結果 (概念ヒント + 出典ページ範囲) */
  currentConcept: AiExtractedNode | null;
  /** 通過してノートに刻めたエントリを親に渡す */
  onCommitted: (entry: NoteEntry) => void;
};

type Stage = "summarizing" | "explain" | "judging" | "done" | "error";

const useClaude = process.env.NEXT_PUBLIC_USE_CLAUDE_API === "true";

export function NoteGateDialog({
  open,
  onOpenChange,
  materialId,
  materialName,
  subjectId,
  subjectName,
  gradeLevel,
  pageNumber,
  pageImagesPacked,
  currentConcept,
  onCommitted,
}: Props) {
  const [stage, setStage] = useState<Stage>("summarizing");
  const [conceptName, setConceptName] = useState("");
  const [summary, setSummary] = useState("");
  const [explanation, setExplanation] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sourcePageRange = currentConcept?.pageRange ?? `p.${pageNumber}`;

  // ----- 開いたら要約を生成 -----
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // ダイアログを開いた時の初期化 (open の立ち上がりで 1 回)。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage("summarizing");
    setConceptName(currentConcept?.name ?? "");
    setSummary("");
    setExplanation("");
    setFeedback(null);
    setErrorMsg(null);

    (async () => {
      try {
        if (!useClaude) {
          // mock: Claude 未使用なら素朴なプレースホルダ要約
          if (cancelled) return;
          setConceptName(currentConcept?.name ?? "この論点");
          setSummary(
            currentConcept?.description ??
              "（AI 要約は Claude 有効時に生成されます。今は仮の要約です）",
          );
          setStage("explain");
          return;
        }
        const out = await summarizeConceptForNote({
          materialName,
          subjectName,
          gradeLevel,
          currentConceptName: currentConcept?.name ?? null,
          pageImagesPacked,
          pageNumber,
        });
        if (cancelled) return;
        setConceptName(out.conceptName);
        setSummary(out.summary);
        setStage("explain");
      } catch (err) {
        console.error("[ノート] 要約生成失敗:", err);
        if (cancelled) return;
        // 動線を止めない: 概念ヒント + プレースホルダで続行
        setConceptName(currentConcept?.name ?? "この論点");
        setSummary(
          currentConcept?.description ??
            "（要約をうまく作れませんでした。ページを見ながら自分で要点を説明してみよう）",
        );
        setStage("explain");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    materialName,
    subjectName,
    gradeLevel,
    pageNumber,
    pageImagesPacked,
    currentConcept,
  ]);

  const commitEntry = useCallback(async () => {
    // 通過 → ノートに刻む。real は DB、mock は in-memory。
    try {
      if (isSupabaseConfigured()) {
        const ownerId = await getCurrentUserId();
        const entry = await insertNoteEntry(
          {
            subjectId,
            conceptName,
            aiSummary: summary,
            status: "understood",
            sourceMaterialId: materialId,
            sourcePageRange,
          },
          ownerId,
        );
        onCommitted(entry);
        return;
      }
    } catch (err) {
      console.error("[ノート] 保存失敗、in-memory にフォールバック:", err);
    }
    // mock / フォールバック
    onCommitted({
      id: `note-local-${Date.now()}`,
      subjectId,
      conceptName,
      aiSummary: summary,
      status: "understood",
      sourceMaterialId: materialId,
      sourcePageRange,
    });
  }, [
    subjectId,
    conceptName,
    summary,
    materialId,
    sourcePageRange,
    onCommitted,
  ]);

  const handleJudge = useCallback(async () => {
    const text = explanation.trim();
    if (text.length === 0) return;
    setStage("judging");
    setFeedback(null);
    try {
      let passed: boolean;
      let fb: string;
      if (!useClaude) {
        // mock: 一定の長さがあれば通過 (能動ゲートの形だけ確認)
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
      if (passed) {
        await commitEntry();
        setFeedback(fb);
        setStage("done");
      } else {
        setFeedback(fb);
        setStage("explain");
      }
    } catch (err) {
      console.error("[ノート] 判定失敗:", err);
      setErrorMsg("判定でエラーが出ました。もう一度試してね。");
      setStage("explain");
    }
  }, [explanation, conceptName, summary, commitEntry]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="size-5 text-primary" />
            ノートにまとめる
          </DialogTitle>
          <DialogDescription>
            {materialName}（{sourcePageRange}）から、理解できたら自分のノートに刻むよ。
          </DialogDescription>
        </DialogHeader>

        {stage === "summarizing" ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>葵先生が今のページを読んで、要点を整理しています…</span>
          </div>
        ) : stage === "done" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <BookOpenCheck className="size-10 text-primary" />
            <p className="text-sm font-medium">ノートに追加したよ ✍️</p>
            {feedback && (
              <p className="text-sm text-muted-foreground">{feedback}</p>
            )}
            <Button className="mt-2" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
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

            {/* 能動ゲート: 自分の言葉で説明 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                自分の言葉で説明してみて
              </label>
              <p className="text-xs text-muted-foreground">
                「分かった」だけじゃなく、要点を自分の言葉で言えたらノートに刻むよ。
              </p>
              <Textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="例: 不定詞の名詞的用法は、to + 動詞で「〜すること」という意味になって…"
                className="min-h-[96px] resize-none"
                disabled={stage === "judging"}
              />
              {feedback && stage === "explain" && (
                <p className="text-sm text-amber-600">{feedback}</p>
              )}
              {errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                やめる
              </Button>
              <Button
                onClick={() => void handleJudge()}
                disabled={stage === "judging" || explanation.trim().length === 0}
                className="gap-2"
              >
                {stage === "judging" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>確認中…</span>
                  </>
                ) : (
                  <span>説明できた、ノートに刻む</span>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
