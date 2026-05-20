"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, Copy, Sparkles } from "lucide-react";

import type { AiAssistPanelView } from "@/types/ai-assist-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function confidenceLabel(confidence: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  return `${pct}%`;
}

const RULE_LABELS: Record<string, string> = {
  low_confidence: "Low confidence",
  negative_sentiment: "Negative sentiment",
  model_escalation: "Model flagged escalation",
  handoff_language: "Handoff language detected",
  unsafe_draft_redacted: "Draft sanitized (no pricing/approvals)",
};

function formatRules(rules: string[]): string {
  return rules
    .map((r) => RULE_LABELS[r] ?? r)
    .join(" · ");
}

export function InboxAiAssistPanel({
  assist,
}: {
  assist: AiAssistPanelView | null;
}) {
  const [copied, setCopied] = useState(false);

  const copyDraft = useCallback(async () => {
    if (!assist?.safeDraftReply.trim()) {
      return;
    }
    try {
      await navigator.clipboard.writeText(assist.safeDraftReply);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [assist]);

  if (!assist) {
    return null;
  }

  const created = new Date(assist.createdAt);
  const createdLabel = Number.isNaN(created.getTime())
    ? assist.createdAt
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(created);

  return (
    <div className="from-muted/35 shrink-0 bg-gradient-to-b to-muted/15 px-4 py-3 shadow-[0_-8px_28px_-10px_rgba(15,23,42,0.08)] sm:px-5 dark:shadow-[0_-10px_32px_-10px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles
          className="text-muted-foreground size-4 shrink-0"
          strokeWidth={1.5}
          aria-hidden
        />
        <p className="text-foreground text-[13px] font-bold tracking-tight">
          AI assist
        </p>
        <span className="text-muted-foreground text-xs">
          Suggested reply — review before sending (never auto-sent)
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-xs font-normal">
          {assist.intent}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal">
          Dept: {assist.department}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal">
          Urgency: {assist.urgency}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal">
          Sentiment: {assist.sentiment}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal">
          Confidence {confidenceLabel(assist.confidence)}
        </Badge>
        {assist.modelSuggestedEscalate ? (
          <Badge variant="outline" className="text-xs font-normal">
            Model → escalate
          </Badge>
        ) : null}
        {assist.escalateEffective ? (
          <Badge variant="destructive" className="text-xs font-normal">
            Human review required
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs font-normal">
            No escalation rules
          </Badge>
        )}
      </div>

      {assist.rulesApplied.length > 0 ? (
        <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
          Rules: {formatRules(assist.rulesApplied)}
        </p>
      ) : null}

      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
        <span className="text-foreground font-medium">Recommended action: </span>
        {assist.recommendedAction}
      </p>

      {assist.draftRedaction?.redacted ? (
        <div className="mt-3 flex gap-2 rounded-lg bg-amber-500/12 px-3 py-2 text-xs leading-relaxed text-amber-950 shadow-[0_2px_10px_-4px_rgba(245,158,11,0.2)] dark:bg-amber-950/45 dark:text-amber-50">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <div>
            <p className="font-medium">Draft was sanitized for safety</p>
            <p className="mt-1 opacity-90">
              The model suggested text that may have included payments, approvals, or
              commitments. A neutral reply is shown below; staff should verify before
              sending.
            </p>
            {assist.draftRedaction.triggers?.length ? (
              <p className="mt-1.5 text-[11px] opacity-80">
                Triggers: {assist.draftRedaction.triggers.join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {assist.runError ? (
        <p className="text-destructive mt-2 text-xs leading-relaxed">
          Run note: {assist.runError}
        </p>
      ) : null}

      <div className="mt-3 rounded-lg bg-background/90 p-3 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05),0_1px_4px_rgba(15,23,42,0.05)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]">
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
            {assist.safeDraftReply.trim()
              ? assist.safeDraftReply
              : "No draft text for this run."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={copyDraft}
            disabled={!assist.safeDraftReply.trim()}
          >
            <Copy className="size-3.5" aria-hidden />
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground mt-2 text-[11px]">
        {assist.promptVersion} · {assist.model} · {createdLabel}
      </p>
    </div>
  );
}
