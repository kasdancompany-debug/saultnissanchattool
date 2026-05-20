import { opportunityScoreBand } from "@/lib/opportunity/score-band";
import type { OpportunitySnapshot } from "@/lib/opportunity/types";
import { cn } from "@/lib/utils";

const bandClass = {
  high: "border-emerald-500/50 bg-emerald-500/12 text-emerald-800 dark:text-emerald-100",
  medium: "border-amber-500/45 bg-amber-500/10 text-amber-950 dark:text-amber-100",
  low: "border-rose-500/35 bg-rose-500/8 text-rose-900 dark:text-rose-100",
} as const;

export function OpportunityScoreInline({
  opportunity,
  className,
}: {
  opportunity: OpportunitySnapshot;
  className?: string;
}) {
  const band = opportunityScoreBand(opportunity.score);

  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md border px-1.5 text-[11px] font-bold tabular-nums tracking-tight",
        bandClass[band],
        className
      )}
      title={`Opportunity ${opportunity.score}`}
    >
      {opportunity.score}
    </span>
  );
}
