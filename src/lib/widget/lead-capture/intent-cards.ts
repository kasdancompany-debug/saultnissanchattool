import type { LeadIntentCard } from "@/lib/widget/lead-capture/types";

export const LEAD_INTENT_CARDS: LeadIntentCard[] = [
  {
    intent: "new_vehicle",
    emoji: "🚗",
    title: "New Vehicle",
    subtitle: "Browse inventory & availability",
  },
  {
    intent: "used_vehicle",
    emoji: "🚘",
    title: "Used Vehicle",
    subtitle: "Pre-owned options & pricing direction",
  },
  {
    intent: "trade_value",
    emoji: "💰",
    title: "Trade Value",
    subtitle: "Estimate in under 60 seconds",
  },
  {
    intent: "service",
    emoji: "🔧",
    title: "Service",
    subtitle: "Book or ask about your vehicle",
  },
  {
    intent: "financing",
    emoji: "💳",
    title: "Financing",
    subtitle: "Payments & pre-approval questions",
  },
  {
    intent: "general",
    emoji: "❓",
    title: "General Question",
    subtitle: "Anything else we can help with",
  },
];
