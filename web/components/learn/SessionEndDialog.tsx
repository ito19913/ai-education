"use client";

/**
 * SessionEndDialog - 学習セッション終了時の「お疲れさま」モーダル。
 *
 * - 今日のサマリーを表示
 * - **AI が見つけた課題候補のチェックリスト**: 本人がチェックしたものだけ
 *   /issues の課題一覧に登録される。同トピックが既存にあれば
 *   「既存と統合 / 別件として登録 / 採用しない」の 3 択。
 * - 履歴へリンク
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Check,
  Clock,
  History,
  MessageSquare,
  Pencil,
  Sparkles,
  Target,
} from "lucide-react";
import { formatElapsed } from "@/lib/learn/use-learning-session";
import type {
  Issue,
  IssueCandidate,
  KnowledgeNode,
  SessionEndReason,
} from "@/lib/learn/types";

/** 候補ごとの本人判定 */
export type CandidateDecision =
  | { kind: "skip" } // 採用しない
  | { kind: "new" } // 別件として登録
  | { kind: "link"; issueId: string }; // 既存課題と統合

export type CandidateDecisions = Record<string, CandidateDecision>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elapsedSec: number;
  endReason: SessionEndReason | null;
  messageCount: number;
  noteEditCount: number;
  visitedNodeCount: number;
  /** AI が今日の会話から検知した課題候補 */
  candidates: IssueCandidate[];
  /** 既存の課題（統合候補表示用） */
  existingIssues: Issue[];
  /** ノード名解決用 */
  nodes: KnowledgeNode[];
  /** 「これで登録」が押された時に呼ばれる */
  onAdoptCandidates: (decisions: CandidateDecisions) => void;
};

const REASON_LABELS: Record<SessionEndReason, string> = {
  manual: "「終了」ボタンで終わりました",
  "auto-idle": "操作がなかったので自動で終わりました",
  "auto-day-change": "日付が変わったので自動で終わりました",
  "browser-close": "ブラウザを閉じたので終わりました",
};

export function SessionEndDialog({
  open,
  onOpenChange,
  elapsedSec,
  endReason,
  messageCount,
  noteEditCount,
  visitedNodeCount,
  candidates,
  existingIssues,
  nodes,
  onAdoptCandidates,
}: Props) {
  // デフォルト判定: suggestedLinkIssueId があれば link、なければ new
  const initialDecisions = useMemo<CandidateDecisions>(() => {
    const d: CandidateDecisions = {};
    for (const c of candidates) {
      d[c.id] = c.suggestedLinkIssueId
        ? { kind: "link", issueId: c.suggestedLinkIssueId }
        : { kind: "new" };
    }
    return d;
  }, [candidates]);

  const [decisions, setDecisions] =
    useState<CandidateDecisions>(initialDecisions);
  const [adopted, setAdopted] = useState(false);

  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;

  const adoptedCount = Object.values(decisions).filter(
    (d) => d.kind !== "skip",
  ).length;

  const handleAdopt = () => {
    onAdoptCandidates(decisions);
    setAdopted(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-5 text-primary" />
            <span>お疲れさま、今日の学習を記録しました</span>
          </DialogTitle>
          <DialogDescription>
            {endReason ? REASON_LABELS[endReason] : "今日の学習が終わりました"}
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardContent className="grid grid-cols-3 gap-3 py-4 text-center">
            <Stat
              icon={<Clock className="size-4 text-primary" />}
              label="学習時間"
              value={formatElapsed(elapsedSec)}
            />
            <Stat
              icon={<MessageSquare className="size-4 text-primary" />}
              label="対話"
              value={`${messageCount}`}
              unit="回"
            />
            <Stat
              icon={<Pencil className="size-4 text-primary" />}
              label="ノート編集"
              value={`${noteEditCount}`}
              unit="回"
            />
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          訪れたノード: {visitedNodeCount} 個
        </p>

        {/* AI が見つけた課題候補 */}
        {candidates.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bot className="size-4 text-primary" />
                <span className="flex-1">
                  AI が今日見つけた課題候補（{candidates.length} 件）
                </span>
                {adopted ? (
                  <Badge variant="default" className="gap-1 text-[10px]">
                    <Check className="size-2.5" />
                    登録済み
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    採用 {adoptedCount} / {candidates.length}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                チェックしたものだけ課題一覧に追加されます。「分からない」「曖昧」と
                AI が見抜いた所です。
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[260px]">
                <div className="flex flex-col gap-2 p-4 pt-0">
                  {candidates.map((c) => (
                    <CandidateRow
                      key={c.id}
                      candidate={c}
                      nodeName={nameOf(c.nodeId)}
                      linkTargetIssue={
                        c.suggestedLinkIssueId
                          ? existingIssues.find(
                              (i) => i.id === c.suggestedLinkIssueId,
                            ) ?? null
                          : null
                      }
                      decision={decisions[c.id]}
                      disabled={adopted}
                      onChange={(d) =>
                        setDecisions((prev) => ({ ...prev, [c.id]: d }))
                      }
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Link href="/history">
            <Button variant="outline" className="gap-2">
              <History className="size-4" />
              <span>履歴を見る</span>
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {candidates.length > 0 && !adopted && (
              <Button onClick={handleAdopt} className="gap-1.5">
                <Target className="size-4" />
                <span>これで登録（{adoptedCount} 件）</span>
              </Button>
            )}
            <Button
              variant={candidates.length === 0 || adopted ? "default" : "outline"}
              onClick={() => onOpenChange(false)}
            >
              閉じる
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CandidateRow({
  candidate,
  nodeName,
  linkTargetIssue,
  decision,
  disabled,
  onChange,
}: {
  candidate: IssueCandidate;
  nodeName: string;
  linkTargetIssue: Issue | null;
  decision: CandidateDecision | undefined;
  disabled: boolean;
  onChange: (d: CandidateDecision) => void;
}) {
  const d = decision ?? { kind: "new" };
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 size-3.5 shrink-0 text-purple-600" />
        <div className="flex-1">
          <p className="text-sm font-medium leading-snug text-foreground">
            {candidate.title}
          </p>
          {candidate.detail && (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {candidate.detail}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <MessageSquare className="size-2.5" />
            <span>{nodeName}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-2">
        {linkTargetIssue && (
          <DecisionRadio
            label={
              <span>
                既存課題と統合:{" "}
                <span className="font-medium text-foreground">
                  「{linkTargetIssue.title}」
                </span>
              </span>
            }
            checked={d.kind === "link"}
            onChange={() =>
              onChange({ kind: "link", issueId: linkTargetIssue.id })
            }
            disabled={disabled}
            recommended
          />
        )}
        <DecisionRadio
          label="別件として新規登録"
          checked={d.kind === "new"}
          onChange={() => onChange({ kind: "new" })}
          disabled={disabled}
        />
        <DecisionRadio
          label="採用しない"
          checked={d.kind === "skip"}
          onChange={() => onChange({ kind: "skip" })}
          disabled={disabled}
          muted
        />
      </div>
    </div>
  );
}

function DecisionRadio({
  label,
  checked,
  onChange,
  disabled,
  recommended,
  muted,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  recommended?: boolean;
  muted?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 text-[11px] ${
        disabled ? "cursor-default opacity-60" : "cursor-pointer"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="size-3 accent-primary"
      />
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>
        {label}
      </span>
      {recommended && (
        <Badge variant="outline" className="ml-auto text-[9px]">
          AI 推奨
        </Badge>
      )}
    </label>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {icon}
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-semibold text-foreground tabular-nums">
        {value}
        {unit && (
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
