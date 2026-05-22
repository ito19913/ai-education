"use client";

/**
 * MaterialListView - 教材の一覧 + 新規追加導線。
 */
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus } from "lucide-react";
import type { Material, Subject } from "@/lib/learn/types";

type Props = {
  subjects: Subject[];
  materials: Material[];
};

export function MaterialListView({ subjects, materials }: Props) {
  const subjectName = (id: string) =>
    subjects.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">教材管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            娘さんが学習する教材を登録・編集します
          </p>
        </div>
        <Link href="/admin/materials/new">
          <Button size="lg" className="gap-2">
            <Plus />
            <span>新しい教材を登録</span>
          </Button>
        </Link>
      </div>

      {materials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto size-10 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              まだ教材が登録されていません。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {materials.map((m) => (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="size-4 text-primary" />
                  <span className="flex-1">{m.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {m.label}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div>
                  <span className="text-foreground">科目:</span>{" "}
                  {subjectName(m.subjectId)}
                </div>
                {m.gradeLevel && (
                  <div>
                    <span className="text-foreground">学年:</span>{" "}
                    {m.gradeLevel}
                  </div>
                )}
                <div>
                  <span className="text-foreground">紐づくノード数:</span>{" "}
                  {m.coveredNodeIds.length}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
