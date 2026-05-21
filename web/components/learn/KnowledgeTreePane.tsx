"use client";

/**
 * KnowledgeTreePane - Pane 2。体系図のツリービュー。
 * 折りたたみ可能な階層リスト。「今ここ」ノードをハイライト。
 * ノードクリックで onSelectNode が呼ばれ、Pane 3 がそのノードに切り替わる。
 */

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronDown, MapPin, Network } from "lucide-react";
import type { KnowledgeNode } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  nodes: KnowledgeNode[];
  currentNodeId: string;
  onSelectNode: (id: string) => void;
};

type ChildMap = Map<string | null, KnowledgeNode[]>;

function buildChildMap(nodes: KnowledgeNode[]): ChildMap {
  const map: ChildMap = new Map();
  for (const node of nodes) {
    const list = map.get(node.parentId) ?? [];
    list.push(node);
    map.set(node.parentId, list);
  }
  return map;
}

export function KnowledgeTreePane({
  nodes,
  currentNodeId,
  onSelectNode,
}: Props) {
  const childMap = buildChildMap(nodes);
  const roots = childMap.get(null) ?? [];

  return (
    <div className="flex w-[560px] shrink-0 flex-col border-r border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Network className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">体系の地図</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          中2 英語文法 全体
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-3">
          {roots.map((root) => (
            <TreeNode
              key={root.id}
              node={root}
              childMap={childMap}
              level={0}
              currentNodeId={currentNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

type TreeNodeProps = {
  node: KnowledgeNode;
  childMap: ChildMap;
  level: number;
  currentNodeId: string;
  onSelectNode: (id: string) => void;
};

function TreeNode({
  node,
  childMap,
  level,
  currentNodeId,
  onSelectNode,
}: TreeNodeProps) {
  const children = childMap.get(node.id) ?? [];
  const isCurrent = node.id === currentNodeId;
  const [open, setOpen] = useState(true);

  const indent = { paddingInlineStart: `${level * 0.75 + 0.25}rem` };

  if (children.length === 0) {
    return (
      <button
        type="button"
        onClick={() => onSelectNode(node.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          isCurrent && "bg-primary/10 font-medium text-primary",
        )}
        style={indent}
      >
        {isCurrent ? (
          <MapPin className="size-3 shrink-0" />
        ) : (
          <span className="size-3 shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "flex items-center rounded-md",
          isCurrent && "bg-primary/10",
        )}
        style={indent}
      >
        <CollapsibleTrigger
          className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-accent"
          aria-label={open ? "閉じる" : "開く"}
        >
          {open ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </CollapsibleTrigger>
        <button
          type="button"
          onClick={() => onSelectNode(node.id)}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm",
            "hover:bg-accent hover:text-accent-foreground",
            isCurrent && "font-medium text-primary",
          )}
        >
          {isCurrent && <MapPin className="size-3 shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      <CollapsibleContent>
        <div className="flex flex-col gap-0.5">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              childMap={childMap}
              level={level + 1}
              currentNodeId={currentNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
