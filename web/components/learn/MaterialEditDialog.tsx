"use client";

/**
 * MaterialEditDialog - 教材の編集 + ゴミ箱に入れる。
 *
 * 誤操作防止のため「削除」は単独メニューから外して、編集ダイアログ内に入れている。
 * 「編集画面に入った人だけが削除できる」設計。
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Trash2 } from "lucide-react";
import type { Material, MaterialLabel } from "@/lib/learn/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
  onSave: (id: string, patch: Partial<Material>) => void;
  onDelete: (id: string) => void;
};

const LABELS: MaterialLabel[] = ["テキスト", "問題集", "副教材"];
const GRADES = ["中1", "中2", "中3", "高1", "高2", "高3"];

export function MaterialEditDialog({
  open,
  onOpenChange,
  material,
  onSave,
  onDelete,
}: Props) {
  const [name, setName] = useState("");
  const [publisher, setPublisher] = useState("");
  const [author, setAuthor] = useState("");
  const [label, setLabel] = useState<MaterialLabel>("テキスト");
  const [gradeLevel, setGradeLevel] = useState("中2");

  // 開いた時に編集対象の値で初期化 (dialog を開く度に props の最新値へ同期する意図的な set)
  useEffect(() => {
    if (material) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(material.name);
      setPublisher(material.publisher ?? "");
      setAuthor(material.author ?? "");
      setLabel(material.label);
      setGradeLevel(material.gradeLevel ?? "中2");
    }
  }, [material]);

  if (!material) return null;

  const handleSave = () => {
    onSave(material.id, { name, publisher, author, label, gradeLevel });
    onOpenChange(false);
  };

  const handleDelete = () => {
    onDelete(material.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>教材を編集</DialogTitle>
          <DialogDescription>
            教材の情報を変更します。不要なら「ゴミ箱に入れる」で削除できます（あとで復元可）。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">教材名</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-publisher">出版社</Label>
              <Input
                id="edit-publisher"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="例: 光村図書"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-author">著者</Label>
              <Input
                id="edit-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="例: 山田太郎"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>種別</Label>
              <Select
                value={label}
                onValueChange={(v) =>
                  setLabel((v ?? "テキスト") as MaterialLabel)
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
                value={gradeLevel}
                onValueChange={(v) => setGradeLevel(v ?? "中2")}
              >
                <SelectTrigger>
                  <SelectValue />
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
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="gap-2"
          >
            <Trash2 className="size-4" />
            <span>ゴミ箱に入れる</span>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
