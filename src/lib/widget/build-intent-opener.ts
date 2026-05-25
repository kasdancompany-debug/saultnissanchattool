import type { LeadIntent } from "@/lib/widget/lead-capture/types";

/** Assistant welcome shown in-widget after the visitor picks a topic (not sent as their message). */
export function getWidgetTopicWelcome(intent: LeadIntent): string {
  switch (intent) {
    case "new_vehicle":
      return "Let's find the right new Nissan for you. Tell us what you're looking for — body style, budget, or when you need it.";
    case "used_vehicle":
      return "We can help with pre-owned options. Share the vehicle you have in mind or describe what you need.";
    case "trade_value":
      return "We can walk you through a trade-in estimate. Share your current vehicle (year, make, model, mileage) when you're ready.";
    case "service":
      return "How can we help with service? Describe the issue or what you'd like to book.";
    case "financing":
      return "Ask us about financing or payments — we'll guide you through the next steps.";
    case "general":
    default:
      return "How can we help you today? Type your question below and our assistant will reply.";
  }
}
