import { Check } from "lucide-react";

import type { OpportunitySignal } from "@/lib/opportunity/types";
import { cn } from "@/lib/utils";

export function OpportunitySignalsList({
  signals,
  className,
  compact,
}: {
  signals: OpportunitySignal[];
  className?: string;
  compact?: boolean;
}) {
  const active = signals.filter((s) => s.active);
  if (active.length === 0) {
    return null;
  }

  return (
    <ul
      className={cn(
        "flex flex-wrap gap-x-2 gap-y-1",
        compact ? "text-[9px]" : "text-[10px]",
        className
      )}
      aria-label="Opportunity signals"
    >
      {active.map((signal) => (
        <li
          key={signal.id}
          className="text-muted-foreground inline-flex items-center gap-0.5 font-medium"
        >
          <Check
            className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <span>{signal.label}</span>
        </li>
      ))}
    </ul>
  );
}
