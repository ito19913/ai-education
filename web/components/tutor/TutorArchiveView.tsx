"use client";

/**
 * TutorArchiveView - ゆい先生との対話アーカイブ（Phase 3 拡張）。
 *
 * 設計（ito19 さん指示 2026-05-24）:
 *   - 1 日 1 thread を localStorage から読み出し
 *   - 日付セレクター（過去 thread の日付一覧）
 *   - 選択日の thread を readonly で表示（セクションヘッダー込み）
 *   - 話題フィルター（朝の振り返り / 課題確認 / 終了 等）
 *
 * 「過去の○○の話、どこだっけ」をサッと見返せる導線。
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  CalendarDays,
  Filter,
  MessageSquare,
  ScrollText,
} from "lucide-react";
import type {
  Issue,
  KnowledgeNode,
  ScheduleItem,
  TutorMessage,
  TutorTopic,
} from "@/lib/learn/types";
import { TutorMessageBubble } from "./TutorMessageBubble";
import { TopicChip } from "./topic-display";
import {
  listTutorThreadDates,
  loadTutorThread,
} from "@/lib/learn/tutor-thread-storage";
import { formatLocalDate } from "@/lib/learn/session-storage";
import { cn } from "@/lib/utils";

// archive は readonly。day-picker カードの選択済みハイライトは出さない (空 Set 固定)
const EMPTY_DAY_PICKED_KEYS = new Set<string>();

type Props = {
  /** ノード名解決用（RangePreviewCard などが必要とする） */
  nodes: KnowledgeNode[];
  /** issue-list / today-schedule カードの描画用 */
  issues: Issue[];
  scheduleItems: ScheduleItem[];
};

const ALL_TOPICS: TutorTopic[] = [
  "morning-reflection",
  "excavation",
  "issue-check",
  "schedule-check",
  "history-check",
  "material-add",
  "subject-history",
  "start-study",
  "ending",
  "free-chat",
];

function formatDateLabel(dateStr: string): string {
  // dateStr = YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  const day = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  const today = formatLocalDate();
  const isToday = dateStr === today;
  return `${y}年${m}月${d}日(${day})${isToday ? " [今日]" : ""}`;
}

export function TutorArchiveView({ nodes, issues, scheduleItems }: Props) {
  // URL ?date=YYYY-MM-DD で初期日付を指定可（検索結果カードからのジャンプ用）
  const searchParams = useSearchParams();
  const urlDate = searchParams.get("date");

  // 保存済み thread の日付一覧（localStorage は client-only なので useEffect で取得）
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(urlDate);
  const [topicFilter, setTopicFilter] = useState<Set<TutorTopic> | null>(null);

  // localStorage は client-only なので mount 後に 1 回だけ load。
  // SSR でも壊れないように useEffect で。setState in effect になるのは
  // 「外部システム (localStorage) からの初期値取得」のためで意図的（lint 例外）。
  useEffect(() => {
    const list = listTutorThreadDates();
    // 新しい日付が上に来るように降順
    const sorted = [...list].sort().reverse();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDates(sorted);
    setSelectedDate((prev) => prev ?? sorted[0] ?? null);
  }, []);

  // URL の date param が変わったら selected date に反映（検索結果からのジャンプ対応）
  useEffect(() => {
    if (urlDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDate(urlDate);
      setTopicFilter(null);
    }
  }, [urlDate]);

  // 選択日の thread を load
  const messages = useMemo(() => {
    if (!selectedDate) return [];
    const stored = loadTutorThread(selectedDate);
    return stored?.messages ?? [];
  }, [selectedDate]);

  // 話題フィルタ適用
  const filteredMessages = useMemo(() => {
    if (!topicFilter || topicFilter.size === 0) return messages;
    // フィルタ in: あるセクションヘッダーの topic が選択されたら、
    // そのヘッダーから次のヘッダーまでのメッセージ全部を残す
    const result: TutorMessage[] = [];
    let currentTopicVisible = false;
    for (const m of messages) {
      if (m.role === "section") {
        currentTopicVisible = m.topic ? topicFilter.has(m.topic) : false;
        if (currentTopicVisible) result.push(m);
        continue;
      }
      // 最初のセクションヘッダー前のメッセージ: m.topic（tutor の場合）で判定
      if (!currentTopicVisible && m.role === "tutor" && m.topic) {
        if (topicFilter.has(m.topic)) {
          result.push(m);
          continue;
        }
      }
      if (currentTopicVisible) result.push(m);
    }
    return result;
  }, [messages, topicFilter]);

  // 話題ごとの件数（フィルタチップに表示）
  const topicCounts = useMemo(() => {
    const counts = new Map<TutorTopic, number>();
    for (const m of messages) {
      if (m.role === "section" && m.topic) {
        counts.set(m.topic, (counts.get(m.topic) ?? 0) + 1);
      }
    }
    // セクションヘッダーがない初期メッセージ用に、最初の tutor message の topic もカウント
    const firstTutor = messages.find((m) => m.role === "tutor");
    if (firstTutor?.topic && !counts.has(firstTutor.topic)) {
      counts.set(firstTutor.topic, 1);
    }
    return counts;
  }, [messages]);

  const toggleTopic = (t: TutorTopic) => {
    setTopicFilter((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(t)) {
        next.delete(t);
      } else {
        next.add(t);
      }
      return next.size === 0 ? null : next;
    });
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      {/* ヘッダ */}
      <header className="border-b border-border bg-background px-5 py-3">
        <div className="flex items-center gap-2">
          <ScrollText className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            ゆい先生との対話履歴
          </h2>
          <span className="text-[11px] text-muted-foreground">
            （全 {dates.length} 日分）
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          1 日 1 chat。日付を選んで、話題で絞り込んで見返せる。読み取り専用。
        </p>
      </header>

      {/* 日付セレクター */}
      <div className="flex flex-col gap-2 border-b border-border bg-muted/20 px-5 py-3">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground">
            日付
          </span>
        </div>
        {dates.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            まだ対話履歴はありません。少し話したら自動的にここに溜まります。
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSelectedDate(d);
                  setTopicFilter(null);
                }}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  selectedDate === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/50",
                )}
              >
                <Calendar className="size-2.5" />
                {formatDateLabel(d)}
              </button>
            ))}
          </div>
        )}

        {/* 話題フィルタ */}
        {selectedDate && topicCounts.size > 0 && (
          <>
            <div className="mt-1 flex items-center gap-1.5">
              <Filter className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">
                話題で絞り込み
              </span>
              {topicFilter && topicFilter.size > 0 && (
                <button
                  type="button"
                  onClick={() => setTopicFilter(null)}
                  className="ml-auto text-[10px] text-primary hover:underline"
                >
                  クリア
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TOPICS.filter((t) => topicCounts.has(t)).map((t) => (
                <TopicChip
                  key={t}
                  topic={t}
                  size="sm"
                  count={topicCounts.get(t)}
                  active={topicFilter?.has(t) ?? false}
                  onClick={() => toggleTopic(t)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* メッセージ表示 (readonly) */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-5">
          {!selectedDate ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <ScrollText className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  日付を選んでください
                </p>
              </CardContent>
            </Card>
          ) : filteredMessages.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <MessageSquare className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  この日の対話はまだありません
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px]">
                  {formatDateLabel(selectedDate)}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  全 {filteredMessages.length} メッセージ
                  {filteredMessages.length !== messages.length &&
                    ` / ${messages.length} 中`}
                </span>
              </div>
              {filteredMessages.map((m) => (
                <TutorMessageBubble
                  key={m.id}
                  message={m}
                  nodes={nodes}
                  issues={issues}
                  scheduleItems={scheduleItems}
                  // readonly なのでカード操作は no-op
                  onPickSubject={() => {
                    /* archive: no-op */
                  }}
                  onPickMaterial={() => {
                    /* archive: no-op */
                  }}
                  onPickDuration={() => {
                    /* archive: no-op (C8 計画立案 duration-picker) */
                  }}
                  onPickWeakNodes={() => {
                    /* archive: no-op (C17 Phase 5 weak-node-picker) */
                  }}
                  // archive: 過去の day-picker は全選択済み扱いにせず空 Set で表示のみ
                  dayPickedKeys={EMPTY_DAY_PICKED_KEYS}
                  onPickDayAssignment={() => {
                    /* archive: no-op (Phase B day-picker) */
                  }}
                  onPickDayBook={() => {
                    /* archive: no-op (Phase B day-picker) */
                  }}
                  onPickDaySegment={() => {
                    /* archive: no-op (Phase B day-segment-picker) */
                  }}
                  onSelectIssue={() => {
                    /* archive: no-op */
                  }}
                  onSeeAllIssues={() => {
                    /* archive: no-op */
                  }}
                  onSelectIssueItem={() => {
                    /* archive: no-op */
                  }}
                  onSeeAllSchedule={() => {
                    /* archive: no-op */
                  }}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
