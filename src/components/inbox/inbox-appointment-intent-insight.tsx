"use client";

import { Sparkles } from "lucide-react";

import type { AppointmentIntentInsight } from "@/lib/opportunity/detect-appointment-intent";
import { APPOINTMENT_DEPARTMENT_LABEL } from "@/lib/appointments/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function confidenceBadgeClass(
  label: AppointmentIntentInsight["confidenceLabel"]
): string {
  if (label === "High") {
    return "border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-50";
  }
  if (label === "Medium") {
    return "border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50";
  }
  return "border-slate-300/80 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100";
}

export function InboxAppointmentIntentInsight({
  intent,
  onConfirmClick,
  isPending,
}: {
  intent: AppointmentIntentInsight;
  onConfirmClick: () => void;
  isPending: boolean;
}) {
  if (!intent.show) {
    return null;
  }

  const departmentLabel = intent.department
    ? APPOINTMENT_DEPARTMENT_LABEL[intent.department]
    : null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-md border border-amber-300/70 bg-amber-50/60 px-3 py-3",
        "dark:border-amber-800 dark:bg-amber-950/35"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Sparkles className="text-amber-800 size-3.5 shrink-0 dark:text-amber-200/90" aria-hidden />
        <span className="text-foreground text-[13px] font-semibold tracking-tight">
          Appointment intent
        </span>
        <Badge
          variant="outline"
          className={cn("text-[11px] font-semibold tabular-nums", confidenceBadgeClass(intent.confidenceLabel))}
        >
          {intent.confidenceLabel} · {intent.confidence}%
        </Badge>
      </div>

      <p className="text-muted-foreground text-[12px] leading-snug">{intent.summary}</p>

      <dl className="grid gap-2 text-[12px]">
        {departmentLabel ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground font-medium">Department</dt>
            <dd className="text-foreground font-medium">{departmentLabel}</dd>
          </div>
        ) : null}
        {intent.proposedTimeLabel ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground font-medium">Proposed</dt>
            <dd className="text-foreground text-right font-medium">
              {intent.proposedTimeLabel}
            </dd>
          </div>
        ) : null}
      </dl>

      {intent.matchedSignals.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {intent.matchedSignals.slice(0, 4).map((signal) => (
            <li key={signal}>
              <Badge variant="outline" className="text-[10px] font-normal">
                {signal}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-foreground/80 text-[11px] leading-snug">
        Suggestion only — nothing is booked until you confirm.
      </p>

      <Button
        type="button"
        size="sm"
        className="h-8 w-full"
        disabled={isPending}
        onClick={onConfirmClick}
      >
        Confirm appointment
      </Button>
    </div>
  );
}
