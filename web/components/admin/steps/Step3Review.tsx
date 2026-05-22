"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Link2,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import type { AiExtractedNode, KnowledgeNode } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  extracted: AiExtractedNode[];
  existingNodes: KnowledgeNode[];
  onUpdateNode: (tempId: string, patch: Partial<AiExtractedNode>) => void;
  onNext: () => void;
  onBack: () => void;
};

export function Step3Review({
  extracted,
  existingNodes,
  onUpdateNode,
  onNext,
  onBack,
}: Props) {
  const approvedCount = extracted.filter(
    (n) => n.reviewStatus === "approved" || n.reviewStatus === "edited",
  ).length;
  const rejectedCount = extracted.filter(
    (n) => n.reviewStatus === "rejected",
  ).length;
  const pendingCount = extracted.filter(
    (n) => n.reviewStatus === "pending",
  ).length;

  const matchedNodeName = (id: string | null) =>
    id ? existingNodes.find((n) => n.id === id)?.name ?? id : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            <span>AI が抽出したノード {extracted.length} 件</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-xs">
            <span className="text-muted-foreground">
              承認:{" "}
              <span className="font-semibold text-primary">{approvedCount}</span>
            </span>
            <span className="text-muted-foreground">
              却下:{" "}
              <span className="font-semibold text-destructive">
                {rejectedCount}
              </span>
            </span>
            <span className="text-muted-foreground">
              未判定:{" "}
              <span className="font-semibold text-foreground">
                {pendingCount}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {extracted.map((node) => {
          const matchedName = matchedNodeName(node.matchedNodeId);
          return (
            <Card
              key={node.tempId}
              className={cn(
                "transition-colors",
                node.reviewStatus === "approved" && "border-primary/50",
                node.reviewStatus === "rejected" &&
                  "border-destructive/30 bg-destructive/5",
              )}
            >
              <CardContent className="flex flex-col gap-2 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-1 flex-col gap-1">
                    <Input
                      value={node.name}
                      onChange={(e) =>
                        onUpdateNode(node.tempId, {
                          name: e.target.value,
                          reviewStatus: "edited",
                        })
                      }
                      className="h-8 max-w-md bg-card font-medium"
                      placeholder="ノード名"
                    />
                    <p className="text-xs text-muted-foreground">
                      {node.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {node.pageRange}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        信頼度 {Math.round(node.confidence * 100)}%
                      </Badge>
                      {matchedName ? (
                        <Badge className="gap-1 bg-primary/15 text-[10px] text-primary hover:bg-primary/15">
                          <Link2 className="size-2.5" />
                          既存と合致: {matchedName}
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-500/15 text-[10px] text-orange-700 hover:bg-orange-500/15">
                          新規候補
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant={
                        node.reviewStatus === "approved" ||
                        node.reviewStatus === "edited"
                          ? "default"
                          : "outline"
                      }
                      className="gap-1"
                      onClick={() =>
                        onUpdateNode(node.tempId, { reviewStatus: "approved" })
                      }
                    >
                      <Check className="size-3" />
                      <span>承認</span>
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        node.reviewStatus === "rejected"
                          ? "destructive"
                          : "outline"
                      }
                      className="gap-1"
                      onClick={() =>
                        onUpdateNode(node.tempId, { reviewStatus: "rejected" })
                      }
                    >
                      <X className="size-3" />
                      <span>却下</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft />
          <span>戻る</span>
        </Button>
        <Button
          size="lg"
          onClick={onNext}
          disabled={approvedCount === 0}
          className="gap-2"
        >
          <span>保存へ</span>
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
