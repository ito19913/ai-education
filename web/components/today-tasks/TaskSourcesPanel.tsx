"use client";

/**
 * TaskSourcesPanel - 各タスク種別の登録状況 + 追加ボタン群。
 *
 * - 試験対策: 現在登録中のプロジェクトと「+ 試験対策を追加（AI と相談）」
 * - 宿題: 現在の宿題一覧と「+ 宿題を追加」
 * - 授業復習: 今日の授業内容を本人入力する入り口
 * - 課題: /issues へのリンク
 *
 * Phase 1 では追加ボタンは Phase 2/3/4 へのスタブ（toast or alert）。
 */
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpenCheck,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  MessageSquare,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import type {
  ExamPrep,
  Homework,
  Issue,
  LessonReview,
  Subject,
} from "@/lib/learn/types";
import { TASK_TYPE_TONE } from "./ScheduleTaskTypeIcon";

type Props = {
  subjects: Subject[];
  exams: ExamPrep[];
  homeworks: Homework[];
  lessonReviews: LessonReview[];
  issues: Issue[];
  /** 「試験対策を追加」ボタン押下（Phase 2 で chat 作成 UI へ）*/
  onAddExamPrep: () => void;
  onAddHomework: () => void;
  onAddLessonReview: () => void;
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function TaskSourcesPanel({
  subjects,
  exams,
  homeworks,
  lessonReviews,
  issues,
  onAddExamPrep,
  onAddHomework,
  onAddLessonReview,
}: Props) {
  const nameOfSubject = (id: string) =>
    subjects.find((s) => s.id === id)?.name ?? id;
  const openIssueCount = issues.filter((i) => i.status === "open").length;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* 試験対策 */}
      <SourceCard
        icon={<GraduationCap className="size-4 text-violet-600" />}
        title="試験対策"
        toneBg={TASK_TYPE_TONE["exam-prep"].bg}
        addLabel="試験対策を追加（AI と相談）"
        addIcon={<Sparkles className="size-3.5" />}
        onAdd={onAddExamPrep}
      >
        {exams.length === 0 ? (
          <EmptyHint>
            次の試験を AI と一緒に計画しましょう。範囲と日程を伝えると、AI が
            日割りまで提案します。
          </EmptyHint>
        ) : (
          exams.map((e) => (
            <SourceRow
              key={e.id}
              title={e.name}
              meta={
                <>
                  {nameOfSubject(e.subjectId)} ・ 試験{" "}
                  {new Date(e.examDate).toLocaleDateString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                  })}
                </>
              }
              badge={
                <Badge variant="outline" className="text-[10px]">
                  あと {daysUntil(e.examDate)} 日
                </Badge>
              }
              href="/tutor?view=materials"
              hrefLabel="範囲を見る"
            />
          ))
        )}
      </SourceCard>

      {/* 宿題 */}
      <SourceCard
        icon={<ClipboardList className="size-4 text-emerald-600" />}
        title="宿題"
        toneBg={TASK_TYPE_TONE["homework"].bg}
        addLabel="宿題を追加"
        addIcon={<Plus className="size-3.5" />}
        onAdd={onAddHomework}
      >
        {homeworks.length === 0 ? (
          <EmptyHint>
            提出物を登録すると、AI が「考え方を一緒に確認しながら」進める計画を
            立てます。
          </EmptyHint>
        ) : (
          homeworks.map((h) => (
            <SourceRow
              key={h.id}
              title={h.name}
              meta={
                <>
                  {nameOfSubject(h.subjectId)} ・ 提出{" "}
                  {new Date(h.dueDate).toLocaleDateString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                  })}
                  {h.amountNote && <> ・ {h.amountNote}</>}
                </>
              }
              badge={
                <Badge variant="outline" className="text-[10px]">
                  あと {daysUntil(h.dueDate)} 日
                </Badge>
              }
              href="/tutor?view=materials"
              hrefLabel="始める"
            />
          ))
        )}
      </SourceCard>

      {/* 授業復習 */}
      <SourceCard
        icon={<BookOpenCheck className="size-4 text-sky-600" />}
        title="授業の新しい学び"
        toneBg={TASK_TYPE_TONE["lesson-review"].bg}
        addLabel="今日の授業を登録"
        addIcon={<Plus className="size-3.5" />}
        onAdd={onAddLessonReview}
      >
        {lessonReviews.length === 0 ? (
          <EmptyHint>
            学校で習った内容を登録すると、今日の復習タスクが自動で生えます。
          </EmptyHint>
        ) : (
          lessonReviews.map((l) => (
            <SourceRow
              key={l.id}
              title={l.topic}
              meta={
                <>
                  {nameOfSubject(l.subjectId)} ・{" "}
                  {new Date(l.lessonDate).toLocaleDateString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                  })}
                </>
              }
              href="/tutor?view=materials"
              hrefLabel="復習する"
            />
          ))
        )}
      </SourceCard>

      {/* 課題（既存 /issues へ） */}
      <SourceCard
        icon={<Target className="size-4 text-orange-600" />}
        title="課題（日々の論点）"
        toneBg={TASK_TYPE_TONE["issue"].bg}
        addLabel="課題一覧を開く"
        addIcon={<ChevronRight className="size-3.5" />}
        onAdd={undefined}
        addHref="/issues"
      >
        <SourceRow
          title={`未クリア ${openIssueCount} 件`}
          meta={
            <>
              掘る対象の論点。AI と話して詰めるのが基本。
            </>
          }
          href="/issues"
          hrefLabel="一覧を見る"
        />
      </SourceCard>
    </div>
  );
}

function SourceCard({
  icon,
  title,
  toneBg,
  addLabel,
  addIcon,
  onAdd,
  addHref,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  toneBg: string;
  addLabel: string;
  addIcon: React.ReactNode;
  onAdd?: () => void;
  addHref?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className={`pb-2 rounded-t-md ${toneBg}`}>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-3">
        {children}
        {addHref ? (
          <Link href={addHref}>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center gap-1.5 border-dashed"
            >
              {addIcon}
              <span>{addLabel}</span>
            </Button>
          </Link>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-1.5 border-dashed"
            onClick={onAdd}
          >
            {addIcon}
            <span>{addLabel}</span>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SourceRow({
  title,
  meta,
  badge,
  href,
  hrefLabel,
}: {
  title: string;
  meta: React.ReactNode;
  badge?: React.ReactNode;
  href: string;
  hrefLabel: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-card p-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{meta}</p>
      </div>
      {badge}
      <Link
        href={href}
        className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <MessageSquare className="size-2.5" />
        <span>{hrefLabel}</span>
      </Link>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border bg-card/40 p-2.5 text-[11px] text-muted-foreground">
      {children}
    </p>
  );
}
