"use client";

/**
 * ResumePane — レジュメを書く常設ペイン (レジュメ構想 フェーズ②/④、2026-06-07)
 *
 * R6: 読書ビューでまとまりを「レジュメにする」と、教材 (単一ページ) の横にこのペインが
 * 出る (旧 NoteGateDialog モーダルの置換、create フローのみ)。子は教科書のお手本を見ずに
 * 自分の言葉でレジュメを書き (R2/R3)、葵が 3 色添削 (R7) する。誤りゼロ & 重大な抜けゼロで
 * 「理解済みにする」(R8、最終決定は本人)。中断は「今日はここまで」で open (Issue) 保存。
 *
 * ※ 音声入力 (R4) と自動リンク (R5) は後続フェーズで追加。本フェーズはテキスト先行。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  PenLine,
  X,
  CircleCheck,
  CircleAlert,
  CircleX,
  Sparkles,
  BookOpenCheck,
  Mic,
  MicOff,
  ChevronDown,
  Star,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import { reviewResume } from "@/lib/notes/note-gate-claude";
import type { ResumeReviewResult } from "@/lib/notes/note-gate-claude";
import {
  insertNoteEntry,
  updateNoteEntry,
  getCurrentUserId,
} from "@/lib/notes/notes-repo";
import { ensureDefaultResume } from "@/lib/notes/resumes-repo";
import type { ConceptSegment, NoteEntry, Resume } from "@/lib/learn/types";

type Props = {
  conceptName: string;
  segment: ConceptSegment | null;
  materialId: string;
  materialName: string;
  subjectId: string;
  subjectName: string;
  gradeLevel: string;
  /** まとまり範囲のページ画像 (base64 JPEG、改行連結)。葵が添削の基準にする */
  pageImagesPacked: string;
  /** 出典表示用ページ範囲 */
  sourcePageRange?: string;
  /** 既存エントリ (続き / 2 周目)。あれば本文初期値 + 更新先 */
  existingEntry?: NoteEntry;
  /** 周回数レベル (0=初回 / 1 以上=2 周目以降) */
  studyLevel?: number;
  /** R10 Phase 2: この科目の冊一覧 (学習中の「入れる冊」セレクター用) */
  subjectResumes?: Resume[];
  /** R10 Phase 2: 学習中に新しい冊を作って入れる */
  onAddResume?: (subjectId: string, name: string) => Promise<Resume | null>;
  /** 刻めた / 更新できたエントリを親へ (upsert) */
  onCommitted: (entry: NoteEntry) => void;
  /** ペインを閉じる (読書ビューに戻る) */
  onClose: () => void;
};

const useClaude = process.env.NEXT_PUBLIC_USE_CLAUDE_API === "true";

type Stage = "writing" | "reviewing" | "reviewed" | "committing" | "done";
type Outcome = "understood" | "open";

export function ResumePane(props: Props) {
  const {
    conceptName,
    segment,
    materialId,
    subjectId,
    subjectName,
    gradeLevel,
    pageImagesPacked,
    sourcePageRange,
    existingEntry,
    studyLevel,
    subjectResumes,
    onAddResume,
    onCommitted,
    onClose,
  } = props;

  const [body, setBody] = useState(existingEntry?.aiSummary ?? "");
  const [stage, setStage] = useState<Stage>("writing");
  const [result, setResult] = useState<ResumeReviewResult | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("understood");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // 直前の添削が「仕上げる(強制・関所)」起点か「葵に見てもらう(任意の途中チェック)」起点か。
  // 仕上げる → 結果に応じて確定へ誘導。任意 → 書き続けに戻す。
  const [finalizeRequested, setFinalizeRequested] = useState(false);

  // ----- R10 Phase 2: 入れる冊の選択 (新規作成時のみ。2 周目=既存は移動しない) -----
  const books = subjectResumes ?? [];
  const defaultBook = books.find((r) => r.isDefault) ?? null;
  // override パターン (描画時解決)。null = デフォルト冊。複数冊ある時だけ UI を出す。
  const [bookOverride, setBookOverride] = useState<string | null>(null);
  const effectiveTargetId =
    bookOverride && books.some((r) => r.id === bookOverride)
      ? bookOverride
      : (defaultBook?.id ?? books[0]?.id ?? null);
  const targetBook = books.find((r) => r.id === effectiveTargetId) ?? null;
  // セレクターを出すのは「新規作成 (existingEntry なし) かつ冊が 1 つ以上」の時。
  const showBookPicker = !existingEntry && books.length >= 1;

  // 音声入力 (R4): 話した内容をレジュメ本文に追記する。
  const {
    supported: micSupported,
    listening,
    interim,
    start: startMic,
    stop: stopMic,
  } = useSpeechRecognition();

  // 確定した聞き取り断片を本文に追記。添削後なら writing に戻す (古い判定で確定させない)。
  const appendVoice = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    setBody((prev) => (prev ? prev + t : t));
    setStage((s) => (s === "reviewed" ? "writing" : s));
  }, []);

  const toggleMic = useCallback(() => {
    if (listening) stopMic();
    else startMic(appendVoice);
  }, [listening, startMic, stopMic, appendVoice]);

  // まとまりが変わったら書き直し (続きなら既存本文を初期値に)。
  const segKey = segment?.id ?? conceptName;
  const lastKey = useRef(segKey);
  useEffect(() => {
    if (lastKey.current === segKey) return;
    lastKey.current = segKey;
    setBody(existingEntry?.aiSummary ?? "");
    setStage("writing");
    setResult(null);
    setErrorMsg(null);
    setFinalizeRequested(false);
  }, [segKey, existingEntry]);

  // ----- 葵に添削してもらう (3 色) -----
  // finalize=true: 「このまとまりを仕上げる」(関所・強制)。false: 任意の途中チェック。
  const handleReview = useCallback(
    async (finalize: boolean) => {
    const text = body.trim();
    if (text.length === 0) return;
    setFinalizeRequested(finalize);
    setStage("reviewing");
    setErrorMsg(null);
    try {
      if (!useClaude) {
        // mock: 20 字以上で resolved 扱いの簡易フィードバック。
        const ok = text.length >= 20;
        setResult({
          points: ok
            ? [{ kind: "ok", text: "自分の言葉で書けているね（mock 判定）" }]
            : [
                {
                  kind: "missing",
                  text: "もう少し具体的に書いてみよう（mock 判定）",
                },
              ],
          resolved: ok,
          encouragement: ok ? "いい感じ！" : "あと少し！",
        });
        setStage("reviewed");
        return;
      }
      const res = await reviewResume({
        conceptName,
        subjectName,
        gradeLevel,
        pageImagesPacked,
        childBody: text,
        formalLevel: studyLevel ?? (existingEntry ? 1 : 0),
      });
      setResult(res);
      setStage("reviewed");
    } catch (err) {
      console.error("[レジュメ] 添削失敗:", err);
      setErrorMsg("添削でエラーが出ました。もう一度試してね。");
      setStage("writing");
    }
  }, [
    body,
    conceptName,
    subjectName,
    gradeLevel,
    pageImagesPacked,
    studyLevel,
    existingEntry,
  ]);

  // ----- 確定 (本人の決定で understood / open) -----
  const finalize = useCallback(
    async (status: Outcome) => {
      const text = body.trim();
      if (text.length === 0) return;
      stopMic(); // 確定するなら録音は止める
      setStage("committing");

      // 2 周目 (既存エントリあり) → 更新。なければ新規作成。
      if (existingEntry) {
        const updated: NoteEntry = {
          ...existingEntry,
          aiSummary: text,
          status,
        };
        try {
          if (isSupabaseConfigured()) {
            await updateNoteEntry(existingEntry.id, {
              aiSummary: text,
              status,
            });
          }
        } catch (err) {
          console.error("[レジュメ] 更新失敗 (in-memory 反映のみ):", err);
        }
        onCommitted(updated);
        setOutcome(status);
        setStage("done");
        return;
      }

      try {
        if (isSupabaseConfigured()) {
          const ownerId = await getCurrentUserId();
          // R10: 入れる冊を決める。Phase 2 でセレクターが選んだ冊 (effectiveTargetId) が
          // あればそれ、無ければ Phase 1 同様にデフォルト冊をオンデマンド確保する。
          let resumeId: string | undefined = effectiveTargetId ?? undefined;
          if (!resumeId) {
            try {
              const resume = await ensureDefaultResume(
                subjectId,
                subjectName,
                ownerId,
              );
              resumeId = resume.id;
            } catch (err) {
              console.error("[レジュメ冊] デフォルト冊の確保失敗 (冊なしで保存):", err);
            }
          }
          const entry = await insertNoteEntry(
            {
              subjectId,
              conceptName,
              aiSummary: text,
              status,
              sourceMaterialId: materialId,
              sourcePageRange,
              sourceSegmentId: segment?.id,
              resumeId,
            },
            ownerId,
          );
          onCommitted(entry);
          setOutcome(status);
          setStage("done");
          return;
        }
      } catch (err) {
        console.error("[レジュメ] 保存失敗、in-memory にフォールバック:", err);
      }
      onCommitted({
        id: `note-local-${Date.now()}`,
        subjectId,
        conceptName,
        aiSummary: text,
        status,
        sourceMaterialId: materialId,
        sourcePageRange,
        sourceSegmentId: segment?.id,
        resumeId: effectiveTargetId ?? undefined,
      });
      setOutcome(status);
      setStage("done");
    },
    [
      body,
      existingEntry,
      subjectId,
      subjectName,
      conceptName,
      materialId,
      sourcePageRange,
      segment,
      effectiveTargetId,
      onCommitted,
      stopMic,
    ],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-amber-50/50 to-background">
      {/* ヘッダー */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 py-2 backdrop-blur">
        <PenLine className="size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">レジュメにする</div>
          <div className="truncate text-xs text-muted-foreground">
            「{conceptName}」
            {sourcePageRange ? `（${sourcePageRange}）` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="閉じて読書に戻る"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        {stage === "done" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <BookOpenCheck
              className={
                outcome === "understood"
                  ? "size-10 text-primary"
                  : "size-10 text-amber-500"
              }
            />
            <p className="text-sm font-medium">
              {outcome === "understood"
                ? "レジュメにしたよ ✍️（理解済み）"
                : "「振り返りたい」として残したよ"}
            </p>
            {result?.encouragement && (
              <p className="text-sm text-muted-foreground">
                {result.encouragement}
              </p>
            )}
            <Button className="mt-2" onClick={onClose}>
              読書に戻る
            </Button>
          </div>
        ) : (
          <>
            {/* R10 Phase 2: 入れる冊セレクター (新規作成時のみ。普段はデフォルトのまま) */}
            {showBookPicker && (
              <div className="flex items-center gap-2 text-xs">
                <span className="shrink-0 text-muted-foreground">入れる冊</span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-medium hover:border-primary"
                        disabled={
                          stage === "reviewing" || stage === "committing"
                        }
                      />
                    }
                  >
                    {targetBook?.isDefault && (
                      <Star className="size-3 text-amber-500" fill="currentColor" />
                    )}
                    <span>{targetBook?.name ?? "レジュメ"}</span>
                    <ChevronDown className="size-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px]">
                    {books.map((r) => (
                      <DropdownMenuItem
                        key={r.id}
                        onClick={() => setBookOverride(r.id)}
                        className="whitespace-nowrap"
                      >
                        {r.isDefault && (
                          <Star
                            className="size-4 shrink-0 text-amber-500"
                            fill="currentColor"
                          />
                        )}
                        {r.name}
                      </DropdownMenuItem>
                    ))}
                    {onAddResume && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="whitespace-nowrap"
                          onClick={() => {
                            void (async () => {
                              const name = `${subjectName}レジュメ${
                                books.length + 1
                              }`;
                              const created = await onAddResume(
                                subjectId,
                                name,
                              );
                              if (created) setBookOverride(created.id);
                            })();
                          }}
                        >
                          <Plus className="size-4 shrink-0" />
                          新しい冊を作る
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* 書く欄 */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">
                  教科書を閉じて、自分の言葉でまとめてみよう
                </label>
                {micSupported && (
                  <Button
                    type="button"
                    size="sm"
                    variant={listening ? "default" : "outline"}
                    onClick={toggleMic}
                    disabled={stage === "reviewing" || stage === "committing"}
                    className="shrink-0 gap-1.5"
                    title={
                      listening
                        ? "タップで停止"
                        : "タップで音声入力。話した内容がレジュメに入るよ"
                    }
                  >
                    {listening ? (
                      <MicOff className="size-4" />
                    ) : (
                      <Mic className="size-4" />
                    )}
                    <span>{listening ? "停止" : "話す"}</span>
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                さっき分かったことを「つまりこういうこと」と要約して。
                {micSupported ? "「話す」で声でも入れられるよ。" : ""}
                お手本は出さないよ — 自分の言葉が大事。
              </p>
              <Textarea
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  // 添削後に編集したら writing に戻す (古い3色判定を確定に使わせない)。
                  if (stage === "reviewed") setStage("writing");
                }}
                placeholder="例: つまり〜ということ。ポイントは〜で、〜のときは〜になる…（自分の言葉でOK）"
                className="min-h-[140px] resize-none"
                disabled={stage === "reviewing" || stage === "committing"}
              />
              {listening && (
                <p className="text-xs text-sky-600">
                  🎙 聞き取り中… {interim || "（話してね）"}
                </p>
              )}
              {errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
            </div>

            {/* 3 色フィードバック (添削後は書き続けても参照できるよう、result があれば表示) */}
            {result && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="size-3.5" />
                  葵先生からの添削
                </div>
                {result.points.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {p.kind === "ok" ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    ) : p.kind === "missing" ? (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    ) : (
                      <CircleX className="mt-0.5 size-4 shrink-0 text-rose-500" />
                    )}
                    <span
                      className={
                        p.kind === "ok"
                          ? "text-emerald-800"
                          : p.kind === "missing"
                            ? "text-amber-800"
                            : "text-rose-800"
                      }
                    >
                      {p.text}
                    </span>
                  </div>
                ))}
                {result.encouragement && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {result.encouragement}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 操作ボタン (フッター) */}
      {stage !== "done" && (
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-background/80 p-2.5 backdrop-blur">
          {stage === "reviewing" || stage === "committing" ? (
            <Button disabled className="gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span>{stage === "reviewing" ? "葵が読んでるよ…" : "保存中…"}</span>
            </Button>
          ) : stage === "reviewed" && finalizeRequested && result?.resolved ? (
            /* 仕上げる → 誤りなし: 確定へ (R8、本人決定) */
            <>
              <Button variant="ghost" onClick={() => setStage("writing")}>
                もう少し直す
              </Button>
              <Button onClick={() => void finalize("understood")}>
                理解済みで確定
              </Button>
            </>
          ) : stage === "reviewed" && finalizeRequested ? (
            /* 仕上げる → 誤り/重大な抜けあり: 直すか Issue で残す */
            <>
              <Button variant="ghost" onClick={() => void finalize("open")}>
                今は Issue で残す
              </Button>
              <Button onClick={() => setStage("writing")}>直す</Button>
            </>
          ) : stage === "reviewed" ? (
            /* 任意の途中チェック後: 書き続ける or 仕上げる (関所) */
            <>
              <Button variant="ghost" onClick={() => setStage("writing")}>
                書き続ける
              </Button>
              <Button onClick={() => void handleReview(true)}>
                このまとまりを仕上げる
              </Button>
            </>
          ) : (
            /* writing: 中断(添削なし) / 任意チェック / 仕上げる(関所・強制添削) */
            <>
              <Button
                variant="ghost"
                onClick={() => void finalize("open")}
                disabled={body.trim().length === 0}
                title="まだ途中。書いた分を Issue として残す (添削なし)"
              >
                今日はここまで
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleReview(false)}
                disabled={body.trim().length === 0}
                title="途中で葵にチェックしてもらう (任意)"
              >
                葵に見てもらう
              </Button>
              <Button
                onClick={() => void handleReview(true)}
                disabled={body.trim().length === 0}
                title="まとまり完成。葵の添削を必ず通す (関所)"
              >
                このまとまりを仕上げる
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
