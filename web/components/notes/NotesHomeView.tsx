"use client";

/**
 * NotesHomeView — まとめノートのホーム (N9① MVP、2026-06-05)
 *
 * grill N2/N7: 子が見る地図は「ノート体系図③ 1 枚」。これがホーム。
 * リスト⇄マップ切替 (MaterialDetailView パターン流用)。
 * - マップ = MindMapPane を再利用 (NoteEntry → KnowledgeNode 形に変換)
 * - リスト = 概念名 + 理解ステータス + AI 要約 + 出典リンク + 自分メモ + 削除
 *
 * MVP は英語のみ (科目セレクタは後回し)。未理解(open) + 振り返りは N9②。
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  List,
  Map as MapIcon,
  NotebookPen,
  PencilLine,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { MindMapPane } from "@/components/learn/MindMapPane";
import { MarkdownText } from "@/components/chat/MarkdownText";
import { parsePageRange } from "@/lib/notes/concept-for-page";
import type { KnowledgeNode, Material, NoteEntry } from "@/lib/learn/types";

type Props = {
  entries: NoteEntry[];
  materials: Material[];
  /** 出典「読む」→ 読書ビューの該当ページへ */
  onOpenSource: (materialId: string, page: number) => void;
  /** 自分メモの保存 */
  onUpdateEntry: (id: string, patch: { userNote?: string }) => void;
  /** エントリ削除 (論理削除) */
  onDeleteEntry: (id: string) => void;
};

export function NotesHomeView({
  entries,
  materials,
  onOpenSource,
  onUpdateEntry,
  onDeleteEntry,
}: Props) {
  const [mode, setMode] = useState<"list" | "map">("list");

  // NoteEntry → MindMapPane 用の KnowledgeNode 形 (MVP は flat、parentRef は未使用)
  const mapNodes = useMemo<KnowledgeNode[]>(
    () =>
      entries.map((e) => ({
        id: e.id,
        name: e.conceptName,
        parentId: e.parentRef ?? null,
        description: e.aiSummary,
      })),
    [entries],
  );

  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      {/* ヘッダー */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-4 py-2">
        <NotebookPen className="size-5 text-primary" />
        <span className="text-sm font-semibold">まとめノート</span>
        <span className="text-xs text-muted-foreground">
          （{entries.length} 件）自分で理解して刻んだ 1 冊
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setMode("list")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              mode === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="size-3.5" />
            リスト
          </button>
          <button
            type="button"
            onClick={() => setMode("map")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              mode === "map"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapIcon className="size-3.5" />
            体系図
          </button>
        </div>
      </div>

      {/* 本体 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-sm text-muted-foreground">
            <NotebookPen className="size-10 text-muted-foreground/60" />
            <p>
              まだノートに刻んだものがないよ。
              <br />
              教材を「一緒に読む」で開いて、
              <strong>「✍️ ここをノートにまとめる」</strong>
              から始めよう。
            </p>
          </div>
        ) : mode === "map" ? (
          <div className="h-[600px]">
            <MindMapPane
              nodes={mapNodes}
              currentNodeId=""
              onSelectNode={() => {}}
              viewTitle="まとめノートの体系図"
              visibleNodeCount={mapNodes.length}
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((e) => (
              <NoteEntryCard
                key={e.id}
                entry={e}
                materialName={
                  materials.find((m) => m.id === e.sourceMaterialId)?.name ?? null
                }
                onOpenSource={onOpenSource}
                onUpdateEntry={onUpdateEntry}
                onDeleteEntry={onDeleteEntry}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NoteEntryCard({
  entry,
  materialName,
  onOpenSource,
  onUpdateEntry,
  onDeleteEntry,
}: {
  entry: NoteEntry;
  materialName: string | null;
  onOpenSource: (materialId: string, page: number) => void;
  onUpdateEntry: (id: string, patch: { userNote?: string }) => void;
  onDeleteEntry: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState(entry.userNote ?? "");

  const startPage = parsePageRange(entry.sourcePageRange)?.start ?? null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{entry.conceptName}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                理解済み
              </span>
            </div>
            <div className="mt-1 text-sm text-card-foreground">
              <MarkdownText text={entry.aiSummary} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDeleteEntry(entry.id)}
            className="text-muted-foreground hover:text-destructive"
            title="このエントリを削除"
            aria-label="削除"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {/* 出典 + 自分メモ */}
        <div className="flex flex-wrap items-center gap-2 pl-6 text-xs text-muted-foreground">
          {materialName && (
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3" />
              出典: {materialName}
              {entry.sourcePageRange ? `（${entry.sourcePageRange}）` : ""}
            </span>
          )}
          {entry.sourceMaterialId && startPage !== null && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => onOpenSource(entry.sourceMaterialId!, startPage)}
            >
              <BookOpen className="size-3" />
              出典を読む
            </Button>
          )}
        </div>

        {/* 自分メモ (N7: 子が所有) */}
        <div className="pl-6">
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="自分の覚え方・引っかかったところをメモ"
                className="min-h-[60px] resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    onUpdateEntry(entry.id, { userNote: memo });
                    setEditing(false);
                  }}
                >
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setMemo(entry.userNote ?? "");
                    setEditing(false);
                  }}
                >
                  やめる
                </Button>
              </div>
            </div>
          ) : entry.userNote ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-left text-xs text-amber-800 hover:bg-amber-100"
            >
              <PencilLine className="mt-0.5 size-3 shrink-0" />
              <span>{entry.userNote}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <PencilLine className="size-3" />
              自分メモを足す
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
