"use client";

/**
 * LearnSidebar - /learn 画面の Pane 1。
 *
 * Claude desktop アプリ風: collapsible="offcanvas" で完全に非表示にできる。
 * Cmd+B (Ctrl+B) でトグル、または LearnHeader の SidebarTrigger でトグル。
 *
 * 階層:
 *   科目（折りたたみ）
 *     └ 教材（ラベル付き、折りたたみ）
 *         └ ノート（ノードリスト、クリックで Pane2/3/4 連動）
 */

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  Book,
  BookOpenCheck,
  ChevronRight,
  FileText,
  Folder,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import type {
  CurrentUser,
  KnowledgeNode,
  Material,
  Note,
  Subject,
} from "@/lib/learn/types";

type Props = {
  user: CurrentUser;
  subjects: Subject[];
  materials: Material[];
  notes: Note[];
  nodes: KnowledgeNode[];
  currentNodeId: string;
  onSelectNode: (id: string) => void;
};

export function LearnSidebar({
  user,
  subjects,
  materials,
  notes,
  nodes,
  currentNodeId,
  onSelectNode,
}: Props) {
  const nameOf = (nodeId: string) =>
    nodes.find((n) => n.id === nodeId)?.name ?? nodeId;
  const hasNote = (nodeId: string) =>
    notes.some((n) => n.nodeId === nodeId);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <BookOpenCheck className="size-5 text-primary" />
          <span className="font-heading text-sm font-medium">AI-Education</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* 科目 → 教材 → ノート の階層 */}
        <SidebarGroup>
          <SidebarGroupLabel>学習</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {subjects.map((subject) => {
                const subjMaterials = materials.filter(
                  (m) => m.subjectId === subject.id,
                );
                return (
                  <Collapsible
                    key={subject.id}
                    defaultOpen
                    className="group/subject"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger render={<SidebarMenuButton />}>
                        <Folder />
                        <span className="flex-1 text-left">
                          {subject.name}
                        </span>
                        <ChevronRight className="ml-auto size-3 transition-transform duration-200 group-data-[state=open]/subject:rotate-90" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {subjMaterials.map((material) => (
                            <MaterialItem
                              key={material.id}
                              material={material}
                              nameOf={nameOf}
                              hasNote={hasNote}
                              currentNodeId={currentNodeId}
                              onSelectNode={onSelectNode}
                            />
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>管理</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="設定">
                    <Settings />
                    <span>設定</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-2 px-2 py-2">
          <div className="flex items-center gap-2 text-xs">
            <User className="size-4 text-muted-foreground" />
            <span className="text-foreground">{user.displayName}</span>
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {user.role}
            </Badge>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="ログアウト">
              <LogOut />
              <span>ログアウト</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function MaterialItem({
  material,
  nameOf,
  hasNote,
  currentNodeId,
  onSelectNode,
}: {
  material: Material;
  nameOf: (id: string) => string;
  hasNote: (id: string) => boolean;
  currentNodeId: string;
  onSelectNode: (id: string) => void;
}) {
  return (
    <Collapsible defaultOpen className="group/material">
      <SidebarMenuSubItem>
        <CollapsibleTrigger render={<SidebarMenuSubButton />}>
          <Book className="size-3.5" />
          <span className="flex-1 truncate text-left">{material.name}</span>
          <Badge
            variant="outline"
            className="ml-1 h-4 px-1.5 text-[9px] font-normal"
          >
            {material.label}
          </Badge>
          <ChevronRight className="ml-1 size-3 transition-transform duration-200 group-data-[state=open]/material:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {material.noteNodeIds.filter(hasNote).map((nodeId) => (
              <SidebarMenuSubItem key={nodeId}>
                <SidebarMenuSubButton
                  isActive={nodeId === currentNodeId}
                  onClick={() => onSelectNode(nodeId)}
                >
                  <FileText className="size-3.5" />
                  <span className="truncate">{nameOf(nodeId)}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}
