import {
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Link2,
  Pencil,
  Sparkles,
  UserX,
} from "lucide-react";

import type { InboxTimelineActivity, TimelineActivityTone } from "@/lib/inbox/inbox-timeline-types";
import { formatMessageTimestamp } from "@/lib/format-time";
import { cn } from "@/lib/utils";

function toneStyles(tone: TimelineActivityTone): {
  rail: string;
  chip: string;
  icon: string;
} {
  switch (tone) {
    case "intent":
      return {
        rail: "border-violet-400/70 bg-violet-50/80 dark:border-violet-700 dark:bg-violet-950/35",
        chip: "text-violet-900 dark:text-violet-100",
        icon: "text-violet-600 dark:text-violet-300",
      };
    case "proposed":
      return {
        rail: "border-amber-400/70 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-950/35",
        chip: "text-amber-950 dark:text-amber-100",
        icon: "text-amber-700 dark:text-amber-300",
      };
    case "confirmed":
      return {
        rail: "border-emerald-400/70 bg-emerald-50/80 dark:border-emerald-700 dark:bg-emerald-950/35",
        chip: "text-emerald-950 dark:text-emerald-100",
        icon: "text-emerald-700 dark:text-emerald-300",
      };
    case "completed":
      return {
        rail: "border-sky-400/70 bg-sky-50/80 dark:border-sky-700 dark:bg-sky-950/35",
        chip: "text-sky-950 dark:text-sky-100",
        icon: "text-sky-700 dark:text-sky-300",
      };
    case "no_show":
      return {
        rail: "border-rose-400/70 bg-rose-50/80 dark:border-rose-700 dark:bg-rose-950/35",
        chip: "text-rose-950 dark:text-rose-100",
        icon: "text-rose-700 dark:text-rose-300",
      };
    case "cancelled":
      return {
        rail: "border-slate-400/60 bg-slate-100/90 dark:border-slate-600 dark:bg-slate-900/50",
        chip: "text-slate-800 dark:text-slate-100",
        icon: "text-slate-600 dark:text-slate-300",
      };
    case "scheduler":
      return {
        rail: "border-indigo-400/70 bg-indigo-50/80 dark:border-indigo-700 dark:bg-indigo-950/35",
        chip: "text-indigo-950 dark:text-indigo-100",
        icon: "text-indigo-700 dark:text-indigo-300",
      };
    case "edited":
      return {
        rail: "border-blue-400/70 bg-blue-50/80 dark:border-blue-700 dark:bg-blue-950/35",
        chip: "text-blue-950 dark:text-blue-100",
        icon: "text-blue-700 dark:text-blue-300",
      };
    default:
      return {
        rail: "border-border/80 bg-muted/40",
        chip: "text-foreground",
        icon: "text-muted-foreground",
      };
  }
}

function ActivityIcon({
  kind,
  className,
}: {
  kind: string;
  className: string;
}) {
  const props = { className, strokeWidth: 1.75, "aria-hidden": true as const };
  if (kind === "appointment_intent_detected") {
    return <Sparkles {...props} />;
  }
  if (kind === "service_scheduler_link_sent") {
    return <Link2 {...props} />;
  }
  if (
    kind === "appointment_proposed" ||
    kind === "appointment_created"
  ) {
    return <CalendarClock {...props} />;
  }
  if (kind === "appointment_confirmed") {
    return <CalendarCheck {...props} />;
  }
  if (kind === "appointment_edited") {
    return <Pencil {...props} />;
  }
  if (kind === "appointment_completed") {
    return <CalendarCheck {...props} />;
  }
  if (kind === "appointment_no_show") {
    return <UserX {...props} />;
  }
  if (kind === "appointment_cancelled") {
    return <CalendarX {...props} />;
  }
  return <Calendar {...props} />;
}

export function InboxTimelineActivityRow({
  activity,
}: {
  activity: InboxTimelineActivity;
}) {
  const styles = toneStyles(activity.tone);

  return (
    <div className="flex w-full justify-center py-0.5" role="listitem">
      <div
        className={cn(
          "flex w-full max-w-md items-start gap-2 rounded-md border px-2.5 py-2 text-left shadow-sm",
          styles.rail
        )}
      >
        <ActivityIcon
          kind={activity.kind}
          className={cn("mt-0.5 size-3.5 shrink-0", styles.icon)}
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0">
            <p className={cn("text-[12px] font-semibold leading-snug", styles.chip)}>
              {activity.title}
            </p>
            <time
              className="text-muted-foreground shrink-0 text-[10px] tabular-nums"
              dateTime={activity.created_at}
            >
              {formatMessageTimestamp(activity.created_at)}
            </time>
          </div>
          {activity.detail ? (
            <p className="text-muted-foreground text-[11px] leading-snug break-words">
              {activity.detail}
            </p>
          ) : null}
          {activity.actorLabel ? (
            <p className="text-muted-foreground/85 text-[10px] leading-snug">
              {activity.actorLabel}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
