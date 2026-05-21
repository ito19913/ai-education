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

import { useMemo, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { LearnSidebar } from "@/components/learn/LearnSidebar";
import { LearnHeader } from "@/components/learn/LearnHeader";
import { MindMapPane } from "@/components/learn/MindMapPane";
import { DialogPane } from "@/components/learn/DialogPane";
import { NotePane } from "@/components/learn/NotePane";
import { LocationCeremony } from "@/components/learn/LocationCeremony";
import type {
  ChatMessage,
  CurrentUser,
  KnowledgeNode,
  LearnSubject,
  Material,
  Memo,
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
  initialMemos: Memo[];
  initialCurrentNodeId: string;
};

export function LearnWorkspace({
  user,
  subject,
  subjects,
  materials,
  nodes,
  initialMessages,
  initialNotes,
  initialMemos,
  initialCurrentNodeId,
}: Props) {
  const [currentNodeId, setCurrentNodeId] = useState(initialCurrentNodeId);
  const [messages] = useState<ChatMessage[]>(initialMessages);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [memos, setMemos] = useState<Memo[]>(initialMemos);
  // セッション開始時の「位置確認の儀式」表示フラグ。
  const [ceremonyDone, setCeremonyDone] = useState(false);

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

  // 選択ノードに紐づくチャット履歴・ノート・メモ
  const currentMessages = useMemo(
    () => messages.filter((m) => m.nodeId === currentNodeId),
    [messages, currentNodeId],
  );
  const currentNote = useMemo(
    () => notes.find((n) => n.nodeId === currentNodeId) ?? null,
    [notes, currentNodeId],
  );
  const currentMemos = useMemo(
    () => memos.filter((m) => m.nodeId === currentNodeId),
    [memos, currentNodeId],
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

  // メモの解決 / 取り消し
  const handleToggleMemoResolved = (id: string) => {
    setMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, resolved: !m.resolved } : m)),
    );
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
      className="h-screen w-full overflow-hidden bg-background text-foreground"
    >
      {!ceremonyDone && (
        <LocationCeremony
          subject={subject}
          allNodes={nodes}
          pathToCurrent={breadcrumb}
          onComplete={() => setCeremonyDone(true)}
        />
      )}
      <LearnSidebar
        user={user}
        subjects={subjects}
        materials={materials}
        notes={notes}
        nodes={nodes}
        onSelectNode={setCurrentNodeId}
        currentNodeId={currentNodeId}
      />
      <SidebarInset className="flex min-w-0 flex-col bg-background">
        <LearnHeader subject={subject} breadcrumb={breadcrumb} />
        <ResizablePanelGroup
          orientation="horizontal"
          className="flex min-h-0 flex-1"
        >
          <ResizablePanel defaultSize={50} minSize={25}>
            <MindMapPane
              nodes={nodes}
              currentNodeId={currentNodeId}
              onSelectNode={setCurrentNodeId}
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
              memos={currentMemos}
              onChangeNote={handleChangeNote}
              onToggleMemoResolved={handleToggleMemoResolved}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  );
}
