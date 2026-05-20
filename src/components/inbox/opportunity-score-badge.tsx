import {
  opportunityBandLabel,
  opportunityScoreBand,
} from "@/lib/opportunity/score-band";
import type { OpportunitySnapshot } from "@/lib/opportunity/types";
import { cn } from "@/lib/utils";

const bandStyles = {
  high: "border-emerald-400/90 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_2px_12px_rgba(16,185,129,0.35)]",
  medium:
    "border-amber-400/90 bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950 shadow-[0_2px_12px_rgba(245,158,11,0.28)]",
  low: "border-rose-400/80 bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-[0_2px_12px_rgba(244,63,94,0.28)]",
} as const;

export function OpportunityScoreBadge({
  opportunity,
  size = "md",
  className,
}: {
  opportunity: OpportunitySnapshot;
  size?: "sm" | "md";
  className?: string;
}) {
  const band = opportunityScoreBand(opportunity.score);
  const label = opportunityBandLabel(band);

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-xl border font-bold tabular-nums",
        bandStyles[band],
        size === "sm" ? "size-11 text-lg" : "size-[3.25rem] text-xl",
        className
      )}
      title={`${label} · ${opportunity.score}/100`}
      aria-label={`Opportunity score ${opportunity.score}, ${label}`}
    >
      <span className="leading-none tracking-tight">{opportunity.score}</span>
    </div>
  );
}
