"use client";

/**
 * TrashSheet - ゴミ箱（論理削除した教材の一覧 + 復元 + 完全削除）。
 * Sheet で右からスライドイン。
 */
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Trash2 } from "lucide-react";
import type { Material } from "@/lib/learn/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deletedMaterials: Material[];
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
};

export function TrashSheet({
  open,
  onOpenChange,
  deletedMaterials,
  onRestore,
  onPermanentDelete,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trash2 className="size-5 text-muted-foreground" />
            <span>ゴミ箱</span>
          </SheetTitle>
          <SheetDescription>
            削除した教材はここに入ります。復元するか、完全に削除できます。
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-4">
          {deletedMaterials.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Trash2 className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  ゴミ箱は空です
                </p>
              </CardContent>
            </Card>
          ) : (
            deletedMaterials.map((m) => (
              <Card key={m.id}>
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-card-foreground">
                        {m.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {m.label}
                        </Badge>
                        {m.gradeLevel && (
                          <Badge variant="outline" className="text-[10px]">
                            {m.gradeLevel}
                          </Badge>
                        )}
                      </div>
                      {m.deletedAt && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          削除日: {new Date(m.deletedAt).toLocaleString("ja-JP")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRestore(m.id)}
                      className="gap-1.5"
                    >
                      <RotateCcw className="size-3" />
                      <span>復元</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (
                          confirm(
                            `「${m.name}」を完全に削除します。\nこの操作は取り消せません。本当によろしいですか?`,
                          )
                        ) {
                          onPermanentDelete(m.id);
                        }
                      }}
                      className="gap-1.5"
                    >
                      <Trash2 className="size-3" />
                      <span>完全に削除</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
