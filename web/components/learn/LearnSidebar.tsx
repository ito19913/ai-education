"use client";

/**
 * LearnSidebar - /learn 画面の Pane 1。
 *
 * Claude desktop アプリ風: collapsible="offcanvas" で完全に非表示にできる。
 * Cmd+B (Ctrl+B) でトグル、または LearnHeader の SidebarTrigger でトグル。
 *
 * 階層 & クリック挙動:
 *   科目（Folder アイコン）
 *     - ラベルクリック: 全体ビュー (onSelectSubject)
 *     - chevron: 折りたたみ
 *     └ 教材（Book アイコン、ラベル付き）
 *           - ラベルクリック: 教材ビュー (onSelectMaterial)
 *           - chevron: 折りたたみ
 *           └ ノード（File アイコン）
 *                 - クリック: そのノードを current に (onSelectNode)
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
import Link from "next/link";
import {
  Book,
  BookOpenCheck,
  ChevronRight,
  FileText,
  Folder,
  LogOut,
  Settings,
  Upload,
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
  currentMaterialId: string | null;
  onSelectNode: (id: string) => void;
  onSelectSubject: (subjectId: string) => void;
  onSelectMaterial: (materialId: string) => void;
};

export function LearnSidebar({
  user,
  subjects,
  materials,
  notes,
  nodes,
  currentNodeId,
  currentMaterialId,
  onSelectNode,
  onSelectSubject,
  onSelectMaterial,
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
        <SidebarGroup>
          <SidebarGroupLabel>学習</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {subjects.map((subject) => {
                const subjMaterials = materials.filter(
                  (m) => m.subjectId === subject.id,
                );
                // 科目のアクティブ判定: 教材未選択かつ Subject が一致
                const isSubjectActive = currentMaterialId === null;
                return (
                  <Collapsible
                    key={subject.id}
                    defaultOpen
                    className="group/subject"
                  >
                    <SidebarMenuItem className="relative">
                      <SidebarMenuButton
                        onClick={() => onSelectSubject(subject.id)}
                        isActive={isSubjectActive}
                        className="pr-8"
                      >
                        <Folder />
                        <span className="flex-1 text-left">
                          {subject.name}
                        </span>
                      </SidebarMenuButton>
                      <CollapsibleTrigger
                        render={
                          <button
                            type="button"
                            aria-label="科目の折りたたみ"
                            className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                          />
                        }
                      >
                        <ChevronRight className="size-3 transition-transform duration-200 group-data-[state=open]/subject:rotate-90" />
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
                              currentMaterialId={currentMaterialId}
                              onSelectNode={onSelectNode}
                              onSelectMaterial={onSelectMaterial}
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
                  <Link href="/admin/materials">
                    <SidebarMenuButton tooltip="教材登録">
                      <Upload />
                      <span>教材登録</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
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
  currentMaterialId,
  onSelectNode,
  onSelectMaterial,
}: {
  material: Material;
  nameOf: (id: string) => string;
  hasNote: (id: string) => boolean;
  currentNodeId: string;
  currentMaterialId: string | null;
  onSelectNode: (id: string) => void;
  onSelectMaterial: (id: string) => void;
}) {
  const isMaterialActive = currentMaterialId === material.id;
  return (
    <Collapsible defaultOpen className="group/material">
      <SidebarMenuSubItem className="relative">
        <SidebarMenuSubButton
          onClick={() => onSelectMaterial(material.id)}
          isActive={isMaterialActive}
          className="pr-8"
        >
          <Book className="size-3.5" />
          <span className="flex-1 truncate text-left">{material.name}</span>
          <Badge
            variant="outline"
            className="ml-1 h-4 px-1.5 text-[9px] font-normal"
          >
            {material.label}
          </Badge>
        </SidebarMenuSubButton>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              aria-label="教材の折りたたみ"
              className="absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            />
          }
        >
          <ChevronRight className="size-3 transition-transform duration-200 group-data-[state=open]/material:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {material.coveredNodeIds.filter(hasNote).map((nodeId) => (
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
