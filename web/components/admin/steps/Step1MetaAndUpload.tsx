"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import type {
  MaterialDraft,
  MaterialLabel,
  Subject,
} from "@/lib/learn/types";
import { cn } from "@/lib/utils";
import {
  extractIngestionText,
  type IngestionText,
} from "@/lib/admin/pdf-extract-text";
import { detectMaterialMetaViaClaude } from "@/lib/admin/detect-meta-claude";

/** Select で「+ 新規科目を追加…」が選ばれた時の特殊 value。2026-05-25 grill 2 S8 由来 */
const ADD_NEW_SUBJECT_VALUE = "__ADD_NEW_SUBJECT__";

type Props = {
  draft: MaterialDraft;
  subjects: Subject[];
  onChange: (draft: MaterialDraft) => void;
  onNext: () => void;
};

const LABELS: MaterialLabel[] = ["テキスト", "問題集", "副教材"];
const GRADES = ["中1", "中2", "中3", "高1", "高2", "高3"];

/**
 * PDF 自動検知の結果メッセージ。
 * - success: 取れた項目を埋めた (filled に項目ラベル)
 * - empty: テキストが取れなかった / 1 項目も判定できなかった
 * - error: 抽出 or Claude でエラー (= 手入力にフォールバック)
 */
type DetectMessage =
  | { kind: "success"; filled: string[] }
  | { kind: "empty" }
  | { kind: "error" }
  | null;

export function Step1MetaAndUpload({
  draft,
  subjects,
  onChange,
  onNext,
}: Props) {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectMessage, setDetectMessage] = useState<DetectMessage>(null);

  /**
   * 2026-06-04 grill: PDF をアップロードした瞬間に AI が表紙を読んで
   * 教材名・科目・種別・学年を自動入力する (確認ありの自動入力)。
   *
   * - NEXT_PUBLIC_USE_CLAUDE_API=true のときのみ自動検知。それ以外は従来の手入力。
   * - 186MB 級の巨大 PDF 全文は渡さず、クライアント側で先頭+末尾の数ページだけ
   *   テキスト抽出 (extractCoverText) → Server Action (detectMaterialMetaViaClaude) に渡す。
   * - 返ってきた「非 null の項目だけ」反映 (部分フォールバック)。
   *   テキスト無し (スキャン PDF) / 失敗時は何も埋めず手入力に落ちる = 動線は止めない。
   *
   * closure の draft が古くならないよう、fileName/fileSize をセットした base を作り、
   * 検知結果も base に合成して 1 回の onChange にまとめる。
   */
  const handleFile = async (file: File | null) => {
    const base: MaterialDraft = {
      ...draft,
      fileName: file?.name ?? null,
      fileSize: file?.size ?? null,
      // 段階1-C: 読書ビューで任意ページを描画するため File 本体も保持する。
      file: file ?? undefined,
    };
    onChange(base);
    setDetectMessage(null);

    if (!file) return;
    const useClaudeApi = process.env.NEXT_PUBLIC_USE_CLAUDE_API === "true";
    if (!useClaudeApi) return;

    setIsDetecting(true);

    // 1) PDF 抽出 (体系図用の目次素材は、メタ検知が失敗しても必ず保持する)。
    //    デジタル PDF → テキスト、スキャン/自炊 PDF → ページ画像 (C85)。
    //    巨大 PDF で抽出自体が失敗する可能性があるので独立した try に分ける。
    let ing: IngestionText = {
      mode: "empty",
      coverText: "",
      tocText: "",
      coverImages: [],
      tocImages: [],
    };
    try {
      ing = await extractIngestionText(file);
    } catch (err) {
      console.error("[PDF 抽出] pdf.js 失敗:", err);
    }

    // 目次素材 (テキスト or 画像) を先に draft に保存 (Step2 の体系図抽出で使う、メタ検知と独立)。
    onChange({ ...base, tocText: ing.tocText, tocImages: ing.tocImages });

    // メタ検知 / 体系図 それぞれの素材有無 (画像はスキャン PDF 経路)。
    const hasCoverSource =
      ing.coverText.trim().length > 0 || ing.coverImages.length > 0;
    const hasTocSource = ing.tocText.length > 0 || ing.tocImages.length > 0;

    if (!hasCoverSource) {
      // 表紙の素材が無い (抽出失敗) → メタ検知はスキップ、手入力に。
      // 目次素材があれば体系図は本物になるので empty、両方ダメなら error。
      setDetectMessage(hasTocSource ? { kind: "empty" } : { kind: "error" });
      setIsDetecting(false);
      return;
    }

    // 2) メタ検知 (失敗しても上で目次素材は保存済 = 体系図には影響しない)。
    try {
      const result = await detectMaterialMetaViaClaude({
        coverText: ing.coverText,
        // 画像は配列のまま渡すと Server Action のガードで 500 になるため改行連結 (C85)。
        coverImagesPacked: ing.coverImages.join("\n"),
        subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
        labels: LABELS,
        grades: GRADES,
      });

      onChange({
        ...base,
        tocText: ing.tocText,
        tocImages: ing.tocImages,
        // 教材名・学年は AI が確信を持てなければ空欄にする (grill 確定 5: 決め打ちしない)。
        name: result.name ?? "",
        gradeLevel: result.gradeLevel ?? "",
        // 科目 (必須) と種別 (3 択は必ず選べる) は、null のときデフォルト/既存を維持。
        ...(result.subjectId ? { subjectId: result.subjectId } : {}),
        ...(result.label ? { label: result.label as MaterialLabel } : {}),
      });

      const filled = [
        result.name ? "教材名" : null,
        result.subjectId ? "科目" : null,
        result.label ? "種別" : null,
        result.gradeLevel ? "学年" : null,
      ].filter((v): v is string => v !== null);

      setDetectMessage(
        filled.length > 0 ? { kind: "success", filled } : { kind: "empty" },
      );
    } catch (err) {
      console.error("[メタ検知] Claude 失敗 (tocText は保持済):", err);
      setDetectMessage({ kind: "error" });
    } finally {
      setIsDetecting(false);
    }
  };

  const canProceed =
    draft.name.trim().length > 0 &&
    draft.subjectId.length > 0 &&
    draft.fileName !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* PDF アップロード (最上部: まずここに入れてもらう) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">PDF アップロード</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0] ?? null;
              if (file) void handleFile(file);
            }}
            onClick={() => {
              if (!isDetecting) fileInputRef.current?.click();
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-foreground/40",
              isDetecting && "pointer-events-none opacity-80",
            )}
          >
            {draft.fileName ? (
              <>
                <FileText className="size-8 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  {draft.fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {draft.fileSize !== null
                    ? `${(draft.fileSize / 1024 / 1024).toFixed(2)} MB`
                    : ""}
                </p>
                {!isDetecting && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    クリックして変更
                  </p>
                )}
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" />
                <p className="text-sm text-foreground">
                  PDF をここにドラッグ&ドロップ、またはクリックで選択
                </p>
                <p className="text-xs text-muted-foreground">
                  対応形式: PDF（教科書、問題集、副教材）
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* 検知中: 「AI が表紙を読んでいます…」 */}
          {isDetecting && (
            <div className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-2 text-sm text-primary">
              <Loader2 className="size-4 animate-spin" />
              <span>📖 AI が表紙を読んで、教材情報を自動入力しています…</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* メタ情報 (PDF の下: 自動入力された内容を確認・修正) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">メタ情報</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* 自動検知の結果メッセージ */}
          {detectMessage?.kind === "success" && (
            <div className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <Sparkles className="mt-0.5 size-4 shrink-0" />
              <span>
                表紙から{detectMessage.filled.join("・")}
                を自動入力したよ。違っていたら直してね。
              </span>
            </div>
          )}
          {detectMessage?.kind === "empty" && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              表紙から自動で読み取れなかったので、お手数だけど入力してね。
            </div>
          )}
          {detectMessage?.kind === "error" && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              表紙の読み取りに失敗したので、お手数だけど入力してね。
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="material-name">教材名 *</Label>
            <Input
              id="material-name"
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              placeholder="例: 中2 英語 教科書 (光村図書)"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label>科目 *</Label>
              <Select
                value={draft.subjectId}
                onValueChange={(v) => {
                  if (v === ADD_NEW_SUBJECT_VALUE) {
                    router.push("/tutor?view=subjects");
                    return;
                  }
                  onChange({ ...draft, subjectId: v ?? "" });
                }}
              >
                <SelectTrigger>
                  {/*
                    Radix SelectValue は SelectItem の children を ref 経由で取得するが、
                    value !== children の時 (科目は value=s.id, children=s.name) SSR で取れず
                    raw value が表示されてしまう。明示的に children を渡して表示テキストを制御。
                  */}
                  <SelectValue placeholder="科目を選択">
                    {subjects.find((s) => s.id === draft.subjectId)?.name ??
                      "科目を選択"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  <div className="my-1 border-t" />
                  <SelectItem value={ADD_NEW_SUBJECT_VALUE} className="text-primary">
                    + 新規科目を追加…
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>種別</Label>
              <Select
                value={draft.label}
                onValueChange={(v) =>
                  onChange({
                    ...draft,
                    label: (v ?? "テキスト") as MaterialLabel,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>学年</Label>
              <Select
                value={draft.gradeLevel}
                onValueChange={(v) =>
                  onChange({ ...draft, gradeLevel: v ?? "中2" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="学年を選択" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!canProceed || isDetecting}
          onClick={onNext}
          className="gap-2"
        >
          <span>AI 抽出に進む</span>
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
