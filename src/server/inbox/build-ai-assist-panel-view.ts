import "server-only";

import { inboundClassificationStoredSchema } from "@/server/ai/schemas/inbound-classification";
import type { LatestAiAssistForInbox } from "@/server/data/message-ai-runs";
import type { AiAssistPanelView } from "@/types/ai-assist-panel";

export function buildAiAssistPanelView(
  latest: LatestAiAssistForInbox | null
): AiAssistPanelView | null {
  if (!latest) {
    return null;
  }

  if (!latest.structured_output) {
    return {
      promptVersion: latest.prompt_version,
      model: latest.model,
      intent: "—",
      department: "—",
      urgency: "—",
      sentiment: "—",
      confidence: 0,
      recommendedAction: "No AI classification payload stored for this run.",
      modelSuggestedEscalate: true,
      escalateEffective: true,
      rulesApplied: [],
      safeDraftReply: "",
      draftRedaction: null,
      runError: latest.error ?? "Missing structured_output",
      createdAt: latest.created_at,
    };
  }

  const parsed = inboundClassificationStoredSchema.safeParse(
    latest.structured_output
  );
  if (!parsed.success) {
    return {
      promptVersion: latest.prompt_version,
      model: latest.model,
      intent: "—",
      department: "—",
      urgency: "—",
      sentiment: "—",
      confidence: 0,
      recommendedAction: "Could not parse stored AI output.",
      modelSuggestedEscalate: true,
      escalateEffective: true,
      rulesApplied: [],
      safeDraftReply: "",
      draftRedaction: null,
      runError: latest.error ?? parsed.error.message,
      createdAt: latest.created_at,
    };
  }

  const s = parsed.data;
  return {
    promptVersion: s.prompt_version,
    model: s.model,
    intent: s.parsed.intent,
    department: s.parsed.department,
    urgency: s.parsed.urgency,
    sentiment: s.parsed.sentiment,
    confidence: s.parsed.confidence,
    recommendedAction: s.parsed.recommended_action,
    modelSuggestedEscalate: s.parsed.escalate_to_human,
    escalateEffective: s.escalate_to_human_effective,
    rulesApplied: s.rules_applied,
    safeDraftReply: s.parsed.safe_draft_reply,
    draftRedaction: s.draft_safety ?? null,
    runError: latest.error,
    createdAt: latest.created_at,
  };
}
