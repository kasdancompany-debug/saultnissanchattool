import type { LeadIntent } from "@/lib/widget/lead-capture/types";

export type WidgetLauncherTeaser = {
  id: string;
  emoji: string;
  label: string;
  shortLabel: string;
  intent: LeadIntent;
  /** Passed to lead flow as the customer’s first selection. */
  flowTitle: string;
};

/** Rotating desktop teasers + mobile pill labels — map 1:1 to guided intake flows. */
export const WIDGET_LAUNCHER_TEASERS: WidgetLauncherTeaser[] = [
  {
    id: "trade",
    emoji: "💰",
    label: "Instant Trade Value",
    shortLabel: "Trade value",
    intent: "trade_value",
    flowTitle: "Instant Trade Value",
  },
  {
    id: "vehicle",
    emoji: "🚗",
    label: "Find My Vehicle",
    shortLabel: "Find vehicle",
    intent: "new_vehicle",
    flowTitle: "Find My Vehicle",
  },
  {
    id: "finance",
    emoji: "💳",
    label: "Get Pre-approved",
    shortLabel: "Pre-approval",
    intent: "financing",
    flowTitle: "Get Pre-approved",
  },
  {
    id: "service",
    emoji: "🔧",
    label: "Book Service",
    shortLabel: "Book service",
    intent: "service",
    flowTitle: "Book Service",
  },
];

export function teaserForIntent(
  intent: LeadIntent
): WidgetLauncherTeaser | undefined {
  return WIDGET_LAUNCHER_TEASERS.find((t) => t.intent === intent);
}
