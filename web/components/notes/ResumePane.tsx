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
  LayoutTemplate,
  Mic,
  MicOff,
  ChevronDown,
  Star,
  Plus,
  Lightbulb,
  Wand2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import {
  reviewResume,
  getResumeHint,
  tidyResumeBody,
} from "@/lib/notes/note-gate-claude";
import type { ResumeReviewResult } from "@/lib/notes/note-gate-claude";
import { suggestResumeTemplate } from "@/lib/notes/template-claude";
import {
  allDeclarations,
  addCustomDeclaration,
  buildFallbackTemplate,
  loadCustomDeclarations,
  tidyTranscriptFallback,
} from "@/lib/notes/declarations";
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
  // R4「ヒントちょうだい」: 押すごとに段階的に濃く (答えは言わない、小出し)。
  const [hints, setHints] = useState<string[]>([]);
  const [hintLoading, setHintLoading] = useState(false);
  // R11-②: 宣言パレット (科目別既定 + 自作 localStorage) + テンプレ提案
  const [customDecls, setCustomDecls] = useState<string[]>(() =>
    loadCustomDeclarations(subjectId),
  );
  const [declInputOpen, setDeclInputOpen] = useState(false);
  const [declInput, setDeclInput] = useState("");
  const [templateLoading, setTemplateLoading] = useState(false);
  const declarations = allDeclarations(subjectId, subjectName, customDecls);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 本文のカーソル位置にスニペットを挿入 (チップ / テンプレ共通)。
  // 添削後の挿入は writing に戻す (古い 3 色判定を確定に使わせない)。
  const insertAtCursor = useCallback(
    (snippet: string) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? body.length;
      const end = el?.selectionEnd ?? start;
      const next = body.slice(0, start) + snippet + body.slice(end);
      setBody(next);
      setStage((s) => (s === "reviewed" ? "writing" : s));
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const pos = start + snippet.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [body],
  );

  // 宣言チップ: 行頭なら【宣言】、行の途中なら改行してから (だらっと続けない型)
  const insertDeclaration = useCallback(
    (label: string) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? body.length;
      const atLineStart = start === 0 || body[start - 1] === "\n";
      insertAtCursor(`${atLineStart ? "" : "\n"}【${label}】`);
    },
    [body, insertAtCursor],
  );

  const submitCustomDeclaration = useCallback(() => {
    const cleaned = declInput.trim();
    if (!cleaned) {
      setDeclInputOpen(false);
      return;
    }
    setCustomDecls(addCustomDeclaration(subjectId, cleaned));
    insertDeclaration(cleaned.replace(/^【|】$/g, "").slice(0, 12));
    setDeclInput("");
    setDeclInputOpen(false);
  }, [declInput, subjectId, insertDeclaration]);

  // R11-②「この型で書く」: AI が教材を見て宣言の並び + 番号枠だけ提案 → カーソル位置に挿入
  const handleTemplate = useCallback(async () => {
    setTemplateLoading(true);
    setErrorMsg(null);
    try {
      let template: string;
      if (useClaude) {
        try {
          template = await suggestResumeTemplate({
            conceptName,
            subjectName,
            gradeLevel,
            pageImagesPacked,
            declarations,
          });
        } catch (err) {
          console.error("[レジュメ] 型の提案失敗、固定テンプレに:", err);
          template = buildFallbackTemplate(subjectId, subjectName);
        }
      } else {
        template = buildFallbackTemplate(subjectId, subjectName);
      }
      // 既に書いた本文があるなら末尾に足す (上書きしない)
      const el = textareaRef.current;
      if (body.trim().length === 0) {
        setBody(template);
        setStage((s) => (s === "reviewed" ? "writing" : s));
        requestAnimationFrame(() => el?.focus());
      } else {
        const sep = body.endsWith("\n") ? "\n" : "\n\n";
        setBody(body + sep + template);
        setStage((s) => (s === "reviewed" ? "writing" : s));
        requestAnimationFrame(() => el?.focus());
      }
    } finally {
      setTemplateLoading(false);
    }
  }, [
    body,
    conceptName,
    subjectName,
    subjectId,
    gradeLevel,
    pageImagesPacked,
    declarations,
  ]);
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

  // R11-③「整える」: 音声文字起こし・勢い書きを、子の言葉のまま記法だけ整える (R2 厳守)
  const [tidyLoading, setTidyLoading] = useState(false);
  const handleTidy = useCallback(async () => {
    const text = body.trim();
    if (text.length === 0) return;
    stopMic(); // 整える間に追記されると上書き競合するので止める
    setTidyLoading(true);
    setErrorMsg(null);
    try {
      let tidied: string;
      if (useClaude) {
        try {
          tidied = await tidyResumeBody({
            conceptName,
            subjectName,
            childBody: text,
            declarations,
          });
        } catch (err) {
          console.error("[レジュメ] 整える失敗、簡易整形に:", err);
          tidied = tidyTranscriptFallback(text);
        }
      } else {
        tidied = tidyTranscriptFallback(text);
      }
      if (tidied.length > 0) {
        setBody(tidied);
        setStage((s) => (s === "reviewed" ? "writing" : s));
      }
    } finally {
      setTidyLoading(false);
    }
  }, [body, conceptName, subjectName, declarations, stopMic]);

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
    setHints([]);
  }, [segKey, existingEntry]);

  // ----- 下書きの自動退避 (2026-06-12 レビュー指摘: 子の本文を失わせない) -----
  // 書きかけ本文を localStorage に自動保存。リロード・誤クローズ・保存失敗でも、
  // 次に同じまとまりを開いた時に復元する。確定 (done) で消す。
  const draftKey = `resume-draft:${materialId}:${segKey}`;
  // 復元: マウント / まとまり切替時、下書きがあれば本文に戻す
  // (下書きは「書いている最中」にしか保存されないので、初期値より新しい前提)。
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (
        saved &&
        saved.trim().length > 0 &&
        saved !== (existingEntry?.aiSummary ?? "")
      ) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 下書き復元はマウント/切替時の 1 回だけ
        setBody(saved);
      }
    } catch {
      // localStorage 不可 (プライベートモード等) は黙って諦める
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draftKey 変化時のみ復元
  }, [draftKey]);
  // 退避: 本文が変わるたび debounce 保存 (空なら消す)。
  useEffect(() => {
    if (stage === "done") return;
    const id = window.setTimeout(() => {
      try {
        if (body.trim().length === 0) {
          window.localStorage.removeItem(draftKey);
        } else {
          window.localStorage.setItem(draftKey, body);
        }
      } catch {
        // ignore
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [body, draftKey, stage]);
  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }, [draftKey]);

  // ----- R4: ヒントちょうだい (押すごとに段階的に濃く、答えは言わない) -----
  const handleHint = useCallback(async () => {
    setHintLoading(true);
    setErrorMsg(null);
    try {
      const level = hints.length + 1;
      if (!useClaude) {
        const mockHints = [
          "まず「これは何と何を分けている話?」と考えてみよう（mock）",
          "教材の太字のところに注目してみて（mock）",
          "「〜のときは〜になる」の形で書き出してみよう（mock）",
        ];
        setHints((prev) => [
          ...prev,
          mockHints[Math.min(level - 1, mockHints.length - 1)],
        ]);
        return;
      }
      const hint = await getResumeHint({
        conceptName,
        subjectName,
        gradeLevel,
        pageImagesPacked,
        childBody: body,
        hintLevel: level,
        previousHints: hints,
      });
      setHints((prev) => [...prev, hint]);
    } catch (err) {
      console.error("[レジュメ] ヒント取得失敗:", err);
      setErrorMsg("ヒントが出せませんでした。もう一度試してね。");
    } finally {
      setHintLoading(false);
    }
  }, [hints, conceptName, subjectName, gradeLevel, pageImagesPacked, body]);

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

      // ★保存失敗を成功に見せない (2026-06-12 レビュー指摘)★: real モードで DB 保存に
      // 失敗したら done にせず、本文を保持したままエラーを見せて再試行できるようにする
      // (本文は下書き自動退避でも守られている)。in-memory フォールバックは mock モード専用。
      const SAVE_FAIL_MSG =
        "保存がうまくいかなかった…ネットを確認して、もう一回ボタンを押してみてね。書いた内容は消えていないよ。";

      // 2 周目 (既存エントリあり) → 更新。なければ新規作成。
      if (existingEntry) {
        const updated: NoteEntry = {
          ...existingEntry,
          aiSummary: text,
          status,
          // updatedAt を進める (2026-06-12 レビュー指摘): 2 周目プラン (countFrom) の
          // 「済み」導出は updatedAt >= countFrom。古いままだとリロードまで進捗が動かない。
          updatedAt: new Date().toISOString(),
        };
        if (isSupabaseConfigured()) {
          try {
            await updateNoteEntry(existingEntry.id, {
              aiSummary: text,
              status,
            });
          } catch (err) {
            console.error("[レジュメ] 更新の保存失敗:", err);
            setErrorMsg(SAVE_FAIL_MSG);
            setStage(result ? "reviewed" : "writing");
            return;
          }
        }
        onCommitted(updated);
        setOutcome(status);
        setStage("done");
        clearDraft();
        return;
      }

      if (isSupabaseConfigured()) {
        try {
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
          clearDraft();
        } catch (err) {
          console.error("[レジュメ] 保存失敗:", err);
          setErrorMsg(SAVE_FAIL_MSG);
          setStage(result ? "reviewed" : "writing");
        }
        return;
      }

      // mock モード (Supabase 未設定) のみ: in-memory で続行 (リロードで消える割り切り)。
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
      clearDraft();
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
      result,
      clearDraft,
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
                <div className="flex shrink-0 items-center gap-1.5">
                  {/* R11-②: AI が教材を見て「宣言の並び + 番号枠」だけ提案 (中身は書かない) */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleTemplate()}
                    disabled={
                      templateLoading ||
                      stage === "reviewing" ||
                      stage === "committing"
                    }
                    className="gap-1.5"
                    title="このまとまりに合う書く型 (宣言と番号の空テンプレ) を入れるよ。中身は自分で埋めてね"
                  >
                    {templateLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LayoutTemplate className="size-4" />
                    )}
                    <span>この型で書く</span>
                  </Button>
                  {/* R4: 詰まったら糸口だけ小出し (答えは言わない) */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleHint()}
                    disabled={
                      hintLoading ||
                      stage === "reviewing" ||
                      stage === "committing"
                    }
                    className="gap-1.5"
                    title="詰まったら葵が糸口を出すよ（答えは言わない）"
                  >
                    {hintLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Lightbulb className="size-4" />
                    )}
                    <span>ヒント</span>
                  </Button>
                  {micSupported && (
                    <Button
                      type="button"
                      size="sm"
                      variant={listening ? "default" : "outline"}
                      onClick={toggleMic}
                      disabled={
                        stage === "reviewing" || stage === "committing"
                      }
                      className="gap-1.5"
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
                  {/* R11-③: 話した/書いた本文を、子の言葉のまま記法だけ整える */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleTidy()}
                    disabled={
                      tidyLoading ||
                      body.trim().length === 0 ||
                      stage === "reviewing" ||
                      stage === "committing"
                    }
                    className="gap-1.5"
                    title="言い回しは変えずに、宣言・番号・改行だけ整えるよ"
                  >
                    {tidyLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Wand2 className="size-4" />
                    )}
                    <span>整える</span>
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                さっき分かったことを「つまりこういうこと」と要約して。
                {micSupported ? "「話す」で声でも入れられるよ。" : ""}
                お手本は出さないよ — 自分の言葉が大事。
              </p>

              {/* R11-②: 宣言パレット (タップで【宣言】挿入。だらっと書かず名前を付けてから書く) */}
              <div className="flex flex-wrap items-center gap-1">
                {declarations.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => insertDeclaration(d)}
                    disabled={stage === "reviewing" || stage === "committing"}
                    className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
                    title={`【${d}】を本文に入れる`}
                  >
                    【{d}】
                  </button>
                ))}
                {declInputOpen ? (
                  <span className="inline-flex items-center gap-1">
                    <Input
                      value={declInput}
                      autoFocus
                      onChange={(ev) => setDeclInput(ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") submitCustomDeclaration();
                        if (ev.key === "Escape") {
                          setDeclInput("");
                          setDeclInputOpen(false);
                        }
                      }}
                      onBlur={submitCustomDeclaration}
                      placeholder="自分の宣言"
                      className="h-6 w-28 px-2 text-[11px]"
                    />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeclInputOpen(true)}
                    disabled={stage === "reviewing" || stage === "committing"}
                    className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                    title="自分の宣言を作る (この科目のパレットに残るよ)"
                  >
                    ＋宣言を作る
                  </button>
                )}
              </div>

              <Textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  // 添削後に編集したら writing に戻す (古い3色判定を確定に使わせない)。
                  if (stage === "reviewed") setStage("writing");
                }}
                placeholder={
                  "例:\n(1)【定義】 つまり〜ということ\n(2)【ポイント】\n①〜\n②〜\n（「この型で書く」で型を入れられるよ）"
                }
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

            {/* R4: 葵のヒント (小出し、答えは言わない) */}
            {hints.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-md border border-sky-200 bg-sky-50/60 p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-sky-700">
                  <Lightbulb className="size-3.5" />
                  葵先生のヒント
                </div>
                {hints.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-sky-900">
                    <span className="mt-0.5 shrink-0 font-medium text-sky-500">
                      {i + 1}.
                    </span>
                    <span>{h}</span>
                  </div>
                ))}
                <p className="text-[11px] text-sky-600">
                  まだ詰まってたら、もう一回「ヒント」を押すともう少し教えるよ。
                </p>
              </div>
            )}

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
