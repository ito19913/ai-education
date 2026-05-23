"use client";

/**
 * LearnWorkspace - /learn 画面の親コンポーネント。
 *
 * 状態モデル:
 *   - currentNodeId: Pane2 でハイライト中のノード
 *   - chatMessages: 全ノードのチャット履歴（ノードごとに nodeId で分離）
 *   - notes: 全ノードのノート（nodeId で 1:1）
 *   - memos: 全ノードのメモ
 *
 * Pane3 と Pane4 は currentNodeId に紐づくものだけ表示する。
 * Pane2 でノードを切り替えると、Pane3 と Pane4 が連動する。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { LearnSidebar } from "@/components/learn/LearnSidebar";
import { LearnHeader } from "@/components/learn/LearnHeader";
import { SidebarResizeHandle } from "@/components/learn/SidebarResizeHandle";
import { MindMapPane } from "@/components/learn/MindMapPane";
import { DialogPane } from "@/components/learn/DialogPane";
import { NotePane } from "@/components/learn/NotePane";
import { TrashSheet } from "@/components/learn/TrashSheet";
import { MaterialEditDialog } from "@/components/learn/MaterialEditDialog";
import { MindMapReconstructionTest } from "@/components/learn/MindMapReconstructionTest";
import {
  SessionEndDialog,
  type CandidateDecisions,
} from "@/components/learn/SessionEndDialog";
import { useLearningSession } from "@/lib/learn/use-learning-session";
import type {
  ChatMessage,
  CurrentUser,
  Issue,
  IssueCandidate,
  IssueOccurrence,
  KnowledgeNode,
  LearnSubject,
  Material,
  Note,
  Subject,
} from "@/lib/learn/types";

type Props = {
  user: CurrentUser;
  subject: LearnSubject;
  subjects: Subject[];
  materials: Material[];
  nodes: KnowledgeNode[];
  initialMessages: ChatMessage[];
  initialNotes: Note[];
  /** 課題（本人発・AI 発 統合）。旧 Memo は本人発として包含。 */
  initialIssues: Issue[];
  initialCurrentNodeId: string;
  /** 復元テストをスキップして直接本編へ（履歴からチャットを開いた時など） */
  skipReconstruction?: boolean;
  /** AI がこのセッションで会話の中から検知した課題候補（mock）。
   * セッション終了時に SessionEndDialog で本人がチェックして採用判定。 */
  sessionIssueCandidates?: IssueCandidate[];
};

export function LearnWorkspace({
  user,
  subject,
  subjects,
  materials: initialMaterials,
  nodes,
  initialMessages,
  initialNotes,
  initialIssues,
  initialCurrentNodeId,
  skipReconstruction = false,
  sessionIssueCandidates = [],
}: Props) {
  // 教材は state 管理（mock の論理削除 / 復元用）。後で Supabase 連携時に置き換え。
  const [materialState, setMaterialState] =
    useState<Material[]>(initialMaterials);
  // 表示用は deletedAt が無いものだけ
  const materials = useMemo(
    () => materialState.filter((m) => !m.deletedAt),
    [materialState],
  );
  const [currentNodeId, setCurrentNodeId] = useState(initialCurrentNodeId);
  const [messages] = useState<ChatMessage[]>(initialMessages);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  // サイドバー幅（px）。SidebarResizeHandle のドラッグで変更。
  const [sidebarWidthPx, setSidebarWidthPx] = useState(256);
  // 体系の地図 (Pane2) の collapse 状態 + Panel ハンドル
  const mindmapPanelRef = useRef<PanelImperativeHandle>(null);
  const [mindmapCollapsed, setMindmapCollapsed] = useState(false);
  const toggleMindmap = () => {
    const panel = mindmapPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  };

  // 体系図のビュー: null = 全体ビュー（Subject 全部）、id = 教材ビュー
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(
    null,
  );

  // 教材の論理削除（ゴミ箱に入れる）
  const handleSoftDeleteMaterial = (id: string) => {
    setMaterialState((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, deletedAt: new Date().toISOString() } : m,
      ),
    );
    // 削除した教材が currentMaterialId だったら全体ビューに戻す
    setCurrentMaterialId((cur) => (cur === id ? null : cur));
  };
  // ゴミ箱から復元
  const handleRestoreMaterial = (id: string) => {
    setMaterialState((prev) =>
      prev.map((m) => (m.id === id ? { ...m, deletedAt: undefined } : m)),
    );
  };
  // 完全削除（mock では state から削除）
  const handlePermanentDeleteMaterial = (id: string) => {
    setMaterialState((prev) => prev.filter((m) => m.id !== id));
  };
  // ゴミ箱 Sheet
  const [trashOpen, setTrashOpen] = useState(false);
  const deletedMaterials = useMemo(
    () => materialState.filter((m) => !!m.deletedAt),
    [materialState],
  );

  // 体系図 復元テスト（学習開始時に出す、スキップ可）
  // skipReconstruction = true なら最初から完了扱い（履歴からチャットへ飛んだ時など）
  const [reconstructionDone, setReconstructionDone] =
    useState(skipReconstruction);

  // 学習セッション（自動開始、終了ボタン + idle 15 分で自動終了）
  const session = useLearningSession({ idleTimeoutMs: 15 * 60 * 1000 });
  const [sessionEndDialogOpen, setSessionEndDialogOpen] = useState(false);
  // 訪れたノードを追跡
  const visitedNodesRef = useRef<Set<string>>(new Set([initialCurrentNodeId]));
  useEffect(() => {
    visitedNodesRef.current.add(currentNodeId);
    session.markActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId]);
  // セッション終了したらダイアログ自動表示
  useEffect(() => {
    if (!session.isActive && session.endedAt) {
      setSessionEndDialogOpen(true);
    }
  }, [session.isActive, session.endedAt]);
  // 学習活動マーキング: ノート編集 / メモトグル時にマーク
  // （ハンドラ実体は下で wrap）

  // 教材編集ダイアログ
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(
    null,
  );
  const editingMaterial = useMemo(
    () => materialState.find((m) => m.id === editingMaterialId) ?? null,
    [materialState, editingMaterialId],
  );
  const handleSaveMaterial = (id: string, patch: Partial<Material>) => {
    setMaterialState((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  };

  // MindMapPane に渡すノードを、ビューに応じてフィルタ
  const visibleNodes = useMemo(() => {
    if (currentMaterialId === null) return nodes;
    const material = materials.find((m) => m.id === currentMaterialId);
    if (!material) return nodes;
    const idSet = new Set(material.coveredNodeIds);
    return nodes.filter((n) => idSet.has(n.id));
  }, [nodes, materials, currentMaterialId]);

  const viewTitle = useMemo(() => {
    if (currentMaterialId === null) {
      const subj = subjects[0];
      return subj ? `${subj.name}（全体）` : "全体";
    }
    const material = materials.find((m) => m.id === currentMaterialId);
    return material ? `${material.name}（${material.label}）` : "教材";
  }, [currentMaterialId, subjects, materials]);

  // 現在ノードまでのパス（ルート → 現在）
  const breadcrumb = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const path: KnowledgeNode[] = [];
    let cursor: KnowledgeNode | undefined = byId.get(currentNodeId);
    while (cursor) {
      path.unshift(cursor);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return path;
  }, [currentNodeId, nodes]);

  const currentNode = useMemo(
    () => nodes.find((n) => n.id === currentNodeId) ?? null,
    [currentNodeId, nodes],
  );

  // 選択ノードに紐づくチャット履歴・ノート・課題
  const currentMessages = useMemo(
    () => messages.filter((m) => m.nodeId === currentNodeId),
    [messages, currentNodeId],
  );
  const currentNote = useMemo(
    () => notes.find((n) => n.nodeId === currentNodeId) ?? null,
    [notes, currentNodeId],
  );
  const currentIssues = useMemo(
    () => issues.filter((i) => i.nodeId === currentNodeId),
    [issues, currentNodeId],
  );

  // ノート編集
  const handleChangeNote = (content: string) => {
    setNotes((prev) => {
      const exists = prev.find((n) => n.nodeId === currentNodeId);
      if (exists) {
        return prev.map((n) =>
          n.nodeId === currentNodeId
            ? { ...n, content, updatedAt: new Date().toISOString() }
            : n,
        );
      }
      return [
        ...prev,
        {
          nodeId: currentNodeId,
          content,
          updatedAt: new Date().toISOString(),
        },
      ];
    });
  };

  // 課題（本人発）の追加: NotePane の入力欄から
  const handleAddIssue = (title: string) => {
    setIssues((prev) => [
      ...prev,
      {
        id: `issue-self-${Date.now()}`,
        nodeId: currentNodeId,
        source: "self",
        title,
        status: "open",
        createdAt: new Date().toISOString(),
        occurrences: [
          {
            id: `occ-${Date.now()}`,
            detectedAt: new Date().toISOString(),
            description: "本人が登録。",
            source: "self",
          },
        ],
      },
    ]);
    session.markActivity();
  };

  // 課題のクリア / 取り消し
  const handleResolveIssue = (id: string) => {
    setIssues((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: "resolved",
              resolvedAt: new Date().toISOString(),
              aiSuggestedClear: false,
              aiSuggestedClearReason: undefined,
            }
          : i,
      ),
    );
    session.markActivity();
  };
  const handleReopenIssue = (id: string) => {
    setIssues((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: "open", resolvedAt: undefined } : i,
      ),
    );
  };

  // セッション終了時の AI 候補の採用: 既存と統合 or 新規登録
  const handleAdoptCandidates = (decisions: CandidateDecisions) => {
    setIssues((prev) => {
      const next = [...prev];
      for (const c of sessionIssueCandidates) {
        const decision = decisions[c.id];
        if (!decision || decision.kind === "skip") continue;

        const occurrence: IssueOccurrence = {
          id: `occ-cand-${c.id}-${Date.now()}`,
          detectedAt: new Date().toISOString(),
          sessionId: session.startedAt, // mock では sessionId 代わりに startedAt
          triggerMessageId: c.triggerMessageId,
          description: c.detail ?? c.title,
          source: "ai-detected",
        };

        if (decision.kind === "link") {
          // 既存課題に発生履歴を追加
          const idx = next.findIndex((i) => i.id === decision.issueId);
          if (idx >= 0) {
            const target = next[idx];
            next[idx] = {
              ...target,
              status: "open", // 統合時は open に戻す
              resolvedAt: undefined,
              occurrences: [...(target.occurrences ?? []), occurrence],
            };
          }
        } else {
          // 新規登録
          next.push({
            id: `issue-ai-${c.id}-${Date.now()}`,
            nodeId: c.nodeId,
            source: "ai-detected",
            title: c.title,
            detail: c.detail,
            status: "open",
            createdAt: new Date().toISOString(),
            occurrences: [occurrence],
          });
        }
      }
      return next;
    });
  };

  // 「もっと詳しく」「もっと簡単に」: MVP モックは console 出力のみ。
  // 後で Claude API にリクエストして補足説明メッセージを追加する。
  const handleAskMore = (messageId: string) => {
    console.log("[ask-more]", messageId);
  };
  const handleAskSimpler = (messageId: string) => {
    console.log("[ask-simpler]", messageId);
  };

  return (
    <SidebarProvider
      defaultOpen
      style={{ "--sidebar-width": `${sidebarWidthPx}px` } as React.CSSProperties}
      className="h-screen w-full overflow-hidden bg-background text-foreground"
    >
      {!reconstructionDone && (
        <MindMapReconstructionTest
          allNodes={nodes}
          scopeNodeIds={
            currentMaterialId
              ? materialState.find((m) => m.id === currentMaterialId)
                  ?.coveredNodeIds
              : undefined
          }
          onComplete={() => setReconstructionDone(true)}
          onSkip={() => setReconstructionDone(true)}
        />
      )}
      <LearnSidebar
        user={user}
        subjects={subjects}
        materials={materials}
        notes={notes}
        nodes={nodes}
        currentNodeId={currentNodeId}
        currentMaterialId={currentMaterialId}
        onSelectNode={setCurrentNodeId}
        onSelectSubject={() => setCurrentMaterialId(null)}
        onSelectMaterial={(id) => setCurrentMaterialId(id)}
        onEditMaterial={(id) => setEditingMaterialId(id)}
        trashCount={deletedMaterials.length}
        onOpenTrash={() => setTrashOpen(true)}
      />
      <TrashSheet
        open={trashOpen}
        onOpenChange={setTrashOpen}
        deletedMaterials={deletedMaterials}
        onRestore={handleRestoreMaterial}
        onPermanentDelete={handlePermanentDeleteMaterial}
      />
      <MaterialEditDialog
        open={editingMaterialId !== null}
        onOpenChange={(open) => !open && setEditingMaterialId(null)}
        material={editingMaterial}
        onSave={handleSaveMaterial}
        onDelete={handleSoftDeleteMaterial}
      />
      <SessionEndDialog
        open={sessionEndDialogOpen}
        onOpenChange={setSessionEndDialogOpen}
        elapsedSec={session.elapsedSec}
        endReason={session.endReason}
        messageCount={currentMessages.length}
        noteEditCount={0}
        visitedNodeCount={visitedNodesRef.current.size}
        candidates={sessionIssueCandidates}
        existingIssues={issues}
        nodes={nodes}
        onAdoptCandidates={handleAdoptCandidates}
      />
      <SidebarInset className="relative flex min-w-0 flex-col bg-background">
        <SidebarResizeHandle onResize={setSidebarWidthPx} />
        <LearnHeader
          subject={subject}
          breadcrumb={breadcrumb}
          mindmapCollapsed={mindmapCollapsed}
          onToggleMindmap={toggleMindmap}
          sessionStatus={session.status}
          elapsedSec={session.elapsedSec}
        />
        <ResizablePanelGroup
          orientation="horizontal"
          className="flex min-h-0 flex-1"
        >
          <ResizablePanel
            panelRef={mindmapPanelRef}
            defaultSize={50}
            minSize={15}
            collapsible
            collapsedSize={0}
            onResize={(size) =>
              setMindmapCollapsed(size.asPercentage === 0)
            }
          >
            <MindMapPane
              nodes={visibleNodes}
              currentNodeId={currentNodeId}
              onSelectNode={setCurrentNodeId}
              viewTitle={viewTitle}
              visibleNodeCount={visibleNodes.length}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={25} minSize={15}>
            <DialogPane
              currentNode={currentNode}
              messages={currentMessages}
              onAskMore={handleAskMore}
              onAskSimpler={handleAskSimpler}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={25} minSize={15}>
            <NotePane
              currentNode={currentNode}
              note={currentNote}
              issues={currentIssues}
              onChangeNote={handleChangeNote}
              onAddIssue={handleAddIssue}
              onResolveIssue={handleResolveIssue}
              onReopenIssue={handleReopenIssue}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  );
}
