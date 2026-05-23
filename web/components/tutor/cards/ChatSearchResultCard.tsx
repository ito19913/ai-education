"use client";

/**
 * ChatSearchResultCard - 「あの話したよね?」検索のヒット候補を出すカード。
 *
 * ito19 さん要望 (2026-05-24):
 *   ゆい先生に「前に〇〇の話したよね?」と聞くと、過去 chat から候補を出す。
 *   候補クリックで該当日のアーカイブにジャンプ。
 */
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MessageSquare, Search, User as UserIcon } from "lucide-react";
import type { TutorCard } from "@/lib/learn/types";
import { TopicChip } from "../topic-display";

type Props = {
  card: Extract<TutorCard, { kind: "chat-search-result" }>;
};

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  const day = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${m}/${d}(${day})`;
}

export function ChatSearchResultCard({ card }: Props) {
  return (
    <Card className="my-2 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Search className="size-3" />
        <span>
          「<span className="font-semibold text-foreground">{card.query}</span>」
          で {card.results.length} 件見つかったよ
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {card.results.map((r) => (
          <Link
            key={`${r.date}-${r.messageId}`}
            href={`/tutor?view=tutor-archive&date=${encodeURIComponent(r.date)}`}
            className="group flex items-start gap-2 rounded-md border border-border bg-card p-2.5 transition-colors hover:border-primary hover:bg-primary/5"
          >
            <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Calendar className="size-2.5" />
                {formatDateShort(r.date)}
              </Badge>
              {r.role === "tutor" ? (
                <Badge
                  variant="outline"
                  className="h-4 gap-0.5 border-primary/40 bg-primary/10 px-1 text-[9px] text-primary"
                  title="ゆい先生の発話"
                >
                  ゆい
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="h-4 gap-0.5 px-1 text-[9px] text-muted-foreground"
                  title="本人の発話"
                >
                  <UserIcon className="size-2" />
                  本人
                </Badge>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {r.topic && <TopicChip topic={r.topic} size="sm" />}
              <p className="line-clamp-2 text-[11px] leading-snug text-card-foreground">
                {r.snippet}
                {r.snippet.length >= 120 && "…"}
              </p>
            </div>
            <MessageSquare className="mt-0.5 size-3 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </Link>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        クリックでその日のアーカイブを右ペインに開きます
      </p>
    </Card>
  );
}
