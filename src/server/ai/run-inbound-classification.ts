import "server-only";
import { z } from "zod";

import type {
  ConversationChannel,
  Sentiment,
  StaffDepartment,
} from "@/integrations/supabase/database.types";
import {
  isConversationHumanControlled,
  isWebChatAutomatedTriageUnblocked,
  mergeConversationControl,
} from "@/lib/conversation/control-metadata";
import { evaluateLiveHours, formatTimezoneShortLabel, parseBusinessHoursConfig } from "@/lib/business-hours";
import {
  isAfterHoursWebChatIntake,
  isWidgetAiIntroMessageSent,
  readWidgetIntakeIntent,
  withWidgetAiIntroMessageSent,
} from "@/lib/conversation/widget-metadata";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import {
  getConversationRowById,
  updateConversationDepartment,
} from "@/server/data/conversations";
import {
  createMessage,
  getMessagesForConversation,
  type ConversationMessageForChatUi,
} from "@/server/data/messages";
import { insertMessageAiRun } from "@/server/data/message-ai-runs";
import { openaiChatCompletionsJson } from "@/server/ai/openai-chat";
import {
  INBOUND_CLASSIFICATION_PROMPT_VERSION,
  INBOUND_CLASSIFICATION_SYSTEM,
  buildInboundClassificationUserPrompt,
} from "@/server/ai/prompts/inbound-classification-v1";
import {
  inboundClassificationModelSchema,
  type InboundClassificationModelOutput,
  type InboundClassificationStored,
} from "@/server/ai/schemas/inbound-classification";
import { getInboundClassificationEnv } from "@/lib/env/inbound-classification-config";
import { capturePipelineFailure } from "@/lib/observability/server-capture";
import { applyAiHumanEscalationStatus } from "@/server/ai/apply-ai-human-escalation-status";
import { applyInboundDraftSafety } from "@/server/ai/safety/inbound-draft-safety";
import { applySentimentEscalation } from "@/server/sentiment/apply-sentiment-escalation";
import { normalizeE164 } from "@/lib/phone/e164";
import { getCustomerById, updateCustomerProfile } from "@/server/data/customers";
import { buildContextualFollowUpFromMessage } from "@/lib/ai/contextual-follow-up";
import {
  formatOffersForPrompt,
  loadOffersForAiContext,
  logOfferCompleteIfAttributed,
  logOfferLeadIfAttributed,
  logOfferStartFromCustomerReply,
  logOfferViewIfPresent,
  readLastOfferedIdFromConversationMetadata,
} from "@/server/ai/lead-offer-context";
import { computeOpportunityScore } from "@/lib/opportunity/compute-opportunity";
import { mergeOpportunityMetadata } from "@/lib/opportunity/metadata";
import {
  buildAiInsightsSnapshot,
  mergeAiInsightsMetadata,
} from "@/lib/conversation/ai-insights-metadata";
import {
  extractProfileHintsFromText,
  isPlaceholderCustomerName,
  mergeExtractedCustomerProfile,
  profileFieldsStillMissing,
} from "@/lib/conversation/extract-profile-hints";
import { ok, type Result } from "@/server/result";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.65;
const HOURS_QUESTION_RE =
  /\b(open|close|closing|hours|what time|until|when are you|when do you)\b/i;
const HANDOFF_LANGUAGE_RE =
  /\b(pass(?:ed|ing)?\s+(?:this\s+)?(?:to|along|over)|handoff|hand\s*off|follow\s*up|team(?:mate)?\s+will\s+(?:reach|contact|follow)|someone\s+from\s+(?:our\s+)?team)\b/i;
const DEPT_AUTO_ROUTE_MIN_CONFIDENCE = 0.62;

const conversationalReplySchema = z.object({
  reply: z.string().min(1).max(1800),
  handoff_now: z.coerce.boolean().default(false),
  offer_id: z.union([z.string().uuid(), z.null()]).optional(),
});

function lastAiOfferIdFromMessages(
  rows: ConversationMessageForChatUi[],
  beforeMessageId: string
): string | null {
  let found = false;
  for (let i = rows.length - 1; i >= 0; i--) {
    const m = rows[i];
    if (m.id === beforeMessageId) {
      found = true;
      continue;
    }
    if (!found) continue;
    if (m.sender_type !== "ai") continue;
    const meta = m.metadata as Record<string, unknown> | null;
    const oid = meta?.offered_lead_offer_id;
    if (typeof oid === "string" && oid.length > 0) return oid;
  }
  return null;
}

function recentAiOfferIds(rows: ConversationMessageForChatUi[]): string[] {
  const ids: string[] = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const m = rows[i];
    if (m.sender_type !== "ai") continue;
    const meta = m.metadata as Record<string, unknown> | null;
    const oid = meta?.offered_lead_offer_id;
    if (typeof oid === "string" && oid.length > 0) ids.push(oid);
    if (ids.length >= 3) break;
  }
  return ids;
}

function buildHeuristicFallbackReply(message: string): string {
  const text = message.toLowerCase();
  if (/\b(price|pricing|cost|payment|lease|finance|apr)\b/.test(text)) {
    return "Happy to help with that. I can guide you through options and connect you with a specialist to confirm exact pricing and payments for your preferred model and trim. Which vehicle are you looking at?";
  }
  if (/\b(stock|available|availability|in stock|have one|still have)\b/.test(text)) {
    return "Great question. I can help check availability right away. Which model, year, and trim are you interested in?";
  }
  if (/\b(service|oil|brake|tires?|tyres?|repair|maintenance)\b/.test(text)) {
    return "I can help with service support. Please share your vehicle year/model and what you need, and I will get the right team to follow up quickly.";
  }
  if (/\b(appointment|book|booking|schedule|test drive)\b/.test(text)) {
    return "Absolutely - I can help get that set up. What day and time work best for you, and which vehicle are you interested in?";
  }
  if (/\b(flat|cracked|broken|windshield|window|bent|leak|won't start|wont start)\b/.test(text)) {
    return "Thanks for describing the issue. I will route this to our service team — if you can share your vehicle year, make, and model, that will help them follow up with you quickly.";
  }
  if (/\b(truck|suv|tundra|f-150|silverado|ram|pickup)\b/i.test(text)) {
    return "Great — I can help with trucks and SUVs. Are you looking for new, used, or certified, and any year or trim in mind?";
  }
  return "Thanks for reaching out. What vehicle or service are you looking for, and what would be most helpful first — availability, pricing direction, or a visit?";
}

function normBodyForDedupe(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[""''`]/g, "'")
    .trim();
}

function isNearDuplicateAssistantReply(prev: string, next: string): boolean {
  const a = normBodyForDedupe(prev);
  const b = normBodyForDedupe(next);
  if (a === b) return true;
  if (a.length < 28 || b.length < 28) return false;
  const n = 72;
  return a.slice(0, n) === b.slice(0, n);
}


function normalizeProfilePatch(input: {
  name?: string | null;
  email?: string | null;
  phoneE164?: string | null;
}): {
  displayName?: string;
  email?: string;
  phoneE164?: string;
} {
  const patch: {
    displayName?: string;
    email?: string;
    phoneE164?: string;
  } = {};

  if (input.name !== undefined) {
    const name = input.name?.trim() ?? "";
    if (name.length >= 2 && name.length <= 120) {
      patch.displayName = name;
    }
  }

  if (input.email !== undefined) {
    const email = input.email?.trim().toLowerCase() ?? "";
    if (email.length > 0) {
      patch.email = email;
    }
  }

  if (input.phoneE164 !== undefined) {
    const normalizedPhone = input.phoneE164
      ? normalizeE164(input.phoneE164)
      : "";
    if (normalizedPhone) {
      patch.phoneE164 = normalizedPhone;
    }
  }

  return patch;
}

function orderMissingProfileFields(fields: string[]): string[] {
  const priority = ["phone", "name", "email"] as const;
  return priority.filter((f) => fields.includes(f));
}

/** Widget uses one LLM call; nudge for contact info without a second completion. */
function augmentWebChatDraftWithProfileAsk(
  draft: string,
  missingOrdered: string[]
): string {
  const base = draft.trim();
  if (missingOrdered.length === 0) {
    return base;
  }
  const field = missingOrdered[0];
  const lower = base.toLowerCase();
  if (
    (field === "phone" && /\b(phone|number|call|text)\b/.test(lower)) ||
    (field === "name" && /\b(name)\b/.test(lower)) ||
    (field === "email" && /\b(email)\b/.test(lower))
  ) {
    return base;
  }
  const ask =
    field === "phone"
      ? " What's the best phone number for our team to reach you?"
      : field === "name"
        ? " May I have your name?"
        : " What's a good email for you?";
  return `${base}${ask}`;
}

async function generateConversationalReply(input: {
  model: string;
  channel: ConversationChannel;
  transcript: string;
  latestCustomerMessage: string;
  classification: InboundClassificationModelOutput;
  currentDepartment: string;
  missingProfileFields: string[];
  activeOffersPrompt: string;
  widgetIntakeTopic?: string | null;
}): Promise<{ reply: string; handoffNow: boolean; offerId: string | null } | null> {
  const missingOrdered = orderMissingProfileFields(input.missingProfileFields);
  const webChatDirect =
    input.channel === "web_chat"
      ? `This reply goes straight to the website visitor (not staff). ${
          missingOrdered.length > 0
            ? `Before deep qualification, naturally ask for their ${missingOrdered[0]} so the team can follow up.`
            : ""
        }`
      : "";
  const system = `You are a sharp dealership sales/service chat assistant (like a strong BDC rep).
Respond naturally to the latest customer turn — reference their exact words and vehicle interest.
${webChatDirect}
Goals:
- Be specific: if they said Tundra/truck/SUV/Escape, acknowledge it and ask ONE smart qualifier (new vs used, year/trim, timeline).
- Do not repeat generic openers ("share more detail", "best next step") if the transcript already has them.
- Collect missing profile fields when natural (phone first, then name, then email) — one ask per turn max.
- Set handoff_now to true ONLY when: they want a human, pricing/payment numbers, same-day appointment, or you cannot help without staff.
- When handoff_now is false, do NOT say you passed this to the team or that someone will follow up.

Safety:
- No pricing/payment/approval commitments or guaranteed inventory/delivery.
- Keep messages concise (1-3 short sentences).

${input.activeOffersPrompt}`;

  const topicLine = input.widgetIntakeTopic
    ? `Widget topic at start: ${input.widgetIntakeTopic.replace(/_/g, " ")}\n`
    : "";
  const user = `Channel: ${input.channel}
${topicLine}Current department: ${input.currentDepartment}
Classifier snapshot:
- intent: ${input.classification.intent}
- department: ${input.classification.department}
- urgency: ${input.classification.urgency}
- sentiment: ${input.classification.sentiment}
- escalate_to_human: ${input.classification.escalate_to_human ? "true" : "false"}
- suggested_action: ${input.classification.recommended_action}

Missing profile fields (collect naturally when possible, priority order): ${
    missingOrdered.length > 0 ? missingOrdered.join(", ") : "none"
  }

Recent transcript (oldest first):
---
${input.transcript}
---

Latest customer message:
"""
${input.latestCustomerMessage}
"""

Return JSON only:
{
  "reply": "<customer-facing reply>",
  "handoff_now": <true|false>,
  "offer_id": "<uuid from active offers list, or null>"
}`;

  try {
    const completion = await openaiChatCompletionsJson({
      model: input.model,
      temperature: 0.25,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsedRaw = JSON.parse(completion.content) as unknown;
    const parsed = conversationalReplySchema.safeParse(parsedRaw);
    if (!parsed.success) {
      return null;
    }
    const offerId =
      typeof parsed.data.offer_id === "string" && parsed.data.offer_id.length > 0
        ? parsed.data.offer_id
        : null;
    return {
      reply: parsed.data.reply.trim(),
      handoffNow: parsed.data.handoff_now,
      offerId,
    };
  } catch {
    return null;
  }
}

async function webChatDistinctAiBody(
  supabase: TypedSupabaseClient,
  input: { channel: ConversationChannel; dealershipId: string; conversationId: string },
  proposed: string
): Promise<string> {
  if (input.channel !== "web_chat") {
    return proposed;
  }
  const trimmed = proposed.trim();
  if (!trimmed) {
    return proposed;
  }

  const msgs = await getMessagesForConversation(
    input.dealershipId,
    input.conversationId,
    { limit: 50, db: supabase }
  );
  if (!msgs.ok) {
    return proposed;
  }

  const byNewestFirst = [...msgs.data].reverse();
  const lastAi = byNewestFirst.find((m) => m.sender_type === "ai");
  if (!lastAi?.body?.trim()) {
    return proposed;
  }

  if (!isNearDuplicateAssistantReply(lastAi.body, trimmed)) {
    return proposed;
  }

  const latestCustomer = byNewestFirst.find((m) => m.sender_type === "customer");
  if (latestCustomer?.body?.trim()) {
    return buildContextualFollowUpFromMessage(latestCustomer.body);
  }
  return buildContextualFollowUpFromMessage(trimmed);
}

function parseThreshold(raw: string): number {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) {
    return DEFAULT_CONFIDENCE_THRESHOLD;
  }
  return Math.min(1, Math.max(0, n));
}

function mapSentimentToConversation(s: string): Sentiment {
  if (s === "positive" || s === "neutral" || s === "negative" || s === "unknown") {
    return s;
  }
  return "unknown";
}

function hasHandoffLanguage(output: InboundClassificationModelOutput): boolean {
  return (
    HANDOFF_LANGUAGE_RE.test(output.safe_draft_reply) ||
    HANDOFF_LANGUAGE_RE.test(output.recommended_action)
  );
}

function buildTranscriptLines(rows: Pick<ConversationMessageForChatUi, "sender_type" | "body">[]): string {
  const lines: string[] = [];
  for (const m of rows) {
    const label =
      m.sender_type === "customer"
        ? "Customer"
        : m.sender_type === "staff"
          ? "Staff"
          : m.sender_type === "system"
            ? "System"
            : "AI";
    const body = (m.body ?? "").trim().replace(/\s+/g, " ");
    if (!body) {
      continue;
    }
    lines.push(`${label}: ${body}`);
  }
  const text = lines.join("\n");
  if (text.length > 8000) {
    return text.slice(-8000);
  }
  return text;
}

function fallbackStored(
  model: string,
  error: string | null,
  latestCustomerMessage: string
): InboundClassificationStored {
  return {
    prompt_version: INBOUND_CLASSIFICATION_PROMPT_VERSION,
    model,
    parsed: {
      intent: "unknown",
      department: "general",
      urgency: "normal",
      sentiment: "unknown",
      confidence: 0,
      recommended_action: "Review this message manually in the inbox.",
      escalate_to_human: true,
      safe_draft_reply: buildHeuristicFallbackReply(latestCustomerMessage),
      customer_profile: {
        name: null,
        email: null,
        phone_e164: null,
      },
    },
    escalate_to_human_effective: true,
    rules_applied: ["model_escalation"],
    parse_error: error ?? undefined,
  };
}

const WEB_CHAT_CONTACT_FALLBACK =
  "Thanks for sharing that. What's the best name and phone number for our team to reach you?";

async function sendWebChatEnvFallbackReply(
  supabase: TypedSupabaseClient,
  input: {
    dealershipId: string;
    conversationId: string;
    messageId: string;
    channel: ConversationChannel;
  }
): Promise<void> {
  if (input.channel !== "web_chat") {
    return;
  }
  const convRow = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  if (
    !convRow.ok ||
    !isWebChatAutomatedTriageUnblocked(
      convRow.data.channel,
      convRow.data.ai_enabled,
      convRow.data.status,
      convRow.data.metadata
    )
  ) {
    return;
  }
  await createMessage(
    {
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      senderType: "ai",
      body: WEB_CHAT_CONTACT_FALLBACK,
      deliveryStatus: "sent",
      metadata: {
        source: "ai_web_chat_env_fallback",
        classification_message_id: input.messageId,
      },
    },
    supabase
  );
}

/**
 * Runs structured classification + safe draft for one inbound customer message.
 * Optional one-shot after-hours web widget auto-reply (service intake) when enabled via env.
 */
export async function runInboundClassification(input: {
  dealershipId: string;
  conversationId: string;
  messageId: string;
  customerMessageBody: string;
  channel: ConversationChannel;
  conversationDepartment: string;
}): Promise<Result<void>> {
  let env: ReturnType<typeof getInboundClassificationEnv>;
  try {
    env = getInboundClassificationEnv();
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[ai] inbound classification skipped: OpenAI env invalid or missing. Set OPENAI_API_KEY in .env.local and restart the dev server. Twilio is not required for widget AI.",
        e
      );
    }
    const supabase = createSupabaseAdminClient();
    await sendWebChatEnvFallbackReply(supabase, input);
    return ok(undefined);
  }

  const supabase = createSupabaseAdminClient();

  let convRow = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  const controlMeta =
    convRow.ok && convRow.data.metadata && typeof convRow.data.metadata === "object"
      ? (convRow.data.metadata as Record<string, unknown>).control
      : null;
  const controlRecord =
    controlMeta && typeof controlMeta === "object" && !Array.isArray(controlMeta)
      ? (controlMeta as Record<string, unknown>)
      : null;
  const aiAutopilotActive =
    convRow.ok &&
    convRow.data.ai_enabled === true &&
    controlRecord?.mode === "ai_led" &&
    controlRecord?.ai_autopilot === true;

  // Local resilience: if AI-led autopilot thread was moved to waiting state, reopen it
  // so inbound auto-replies can continue.
  if (convRow.ok && convRow.data.status === "waiting_for_human" && aiAutopilotActive) {
    await supabase
      .from("conversations")
      .update({
        status: "open",
        metadata: mergeConversationControl(convRow.data.metadata, {
          handling_mode: "ai_active",
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("dealership_id", input.dealershipId)
      .eq("id", input.conversationId);

    convRow = await getConversationRowById(
      input.dealershipId,
      input.conversationId,
      supabase
    );
  }

  const humanControlled =
    convRow.ok && isConversationHumanControlled(convRow.data.metadata);
  /** SMS / non-web: `waiting_for_human` usually blocks AI. Web chat is exempt (see `isWebChatAutomatedTriageUnblocked`). */
  const blockForWaitingQueue =
    convRow.ok &&
    convRow.data.status === "waiting_for_human" &&
    !aiAutopilotActive;
  const webChatUnblocked = convRow.ok
    ? isWebChatAutomatedTriageUnblocked(
        convRow.data.channel,
        convRow.data.ai_enabled,
        convRow.data.status,
        convRow.data.metadata
      )
    : false;
  const blockAiCustomerMessages =
    convRow.ok &&
    (humanControlled ||
      (blockForWaitingQueue && !webChatUnblocked) ||
      convRow.data.ai_enabled === false);

  const aiModeActive =
    convRow.ok &&
    convRow.data.channel === "web_chat" &&
    isWebChatAutomatedTriageUnblocked(
      convRow.data.channel,
      convRow.data.ai_enabled,
      convRow.data.status,
      convRow.data.metadata
    );

  // Deterministic fast path for direct hours questions so customers get a clear answer.
  if (
    aiModeActive &&
    !blockAiCustomerMessages &&
    HOURS_QUESTION_RE.test(input.customerMessageBody)
  ) {
    const dealer = await supabase
      .from("dealerships")
      .select("name, timezone, business_hours")
      .eq("id", input.dealershipId)
      .maybeSingle();

    if (dealer.data && convRow.ok) {
      const cfg = parseBusinessHoursConfig(
        dealer.data.business_hours as import("@/integrations/supabase/database.types").Json,
        dealer.data.timezone
      );
      const live = evaluateLiveHours(
        cfg,
        convRow.data.department ?? "general",
        new Date()
      );
      const tzLabel = formatTimezoneShortLabel(live.timezone);
      const when = live.within_live_hours
        ? `we are open right now (${tzLabel})`
        : `we are currently closed (${tzLabel})`;
      const reply = `${when}. If you tell me whether this is for sales or service, I can guide you to the best next step right away.`;
      const distinctReply = await webChatDistinctAiBody(supabase, input, reply);

      await createMessage(
        {
          dealershipId: input.dealershipId,
          conversationId: input.conversationId,
          senderType: "ai",
          body: distinctReply,
          deliveryStatus: "sent",
          metadata: {
            source: "ai_direct_hours_answer",
            classification_message_id: input.messageId,
          },
        },
        supabase
      );
      return ok(undefined);
    }
  }

  if (env.AI_INBOUND_CLASSIFICATION_ENABLED === "false") {
    await applySentimentEscalation({
      supabase,
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      inboundBody: input.customerMessageBody,
      ai: null,
    });
    return ok(undefined);
  }
  const started = Date.now();
  const model = env.AI_MODEL.trim() || "gpt-4o-mini";
  const threshold = parseThreshold(env.AI_CONFIDENCE_THRESHOLD.trim());

  const msgs = await getMessagesForConversation(
    input.dealershipId,
    input.conversationId,
    { limit: 40, db: supabase }
  );

  const transcript = msgs.ok ? buildTranscriptLines(msgs.data) : "";

  if (msgs.ok) {
    const lastOffer = lastAiOfferIdFromMessages(msgs.data, input.messageId);
    await logOfferStartFromCustomerReply({
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      lastAiOfferId: lastOffer,
    });
  }

  const widgetIntakeTopic =
    convRow.ok ? readWidgetIntakeIntent(convRow.data.metadata) : null;

  const userPrompt = buildInboundClassificationUserPrompt({
    channel: input.channel,
    conversationDepartment: input.conversationDepartment,
    recentTranscript: transcript,
    latestCustomerMessage: input.customerMessageBody,
    widgetIntakeTopic,
  });

  let modelOutput: InboundClassificationModelOutput | null = null;
  let errorText: string | null = null;

  try {
    const completion = await openaiChatCompletionsJson({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: INBOUND_CLASSIFICATION_SYSTEM },
        { role: "user", content: userPrompt },
      ],
    });
    const parsedRaw = JSON.parse(completion.content) as unknown;
    const parsed = inboundClassificationModelSchema.safeParse(parsedRaw);
    if (!parsed.success) {
      errorText = parsed.error.message;
    } else {
      modelOutput = parsed.data;
    }
  } catch (e) {
    errorText = e instanceof Error ? e.message : String(e);
  }

  const latency = Date.now() - started;

  if (!modelOutput) {
    const stored = fallbackStored(model, errorText, input.customerMessageBody);
    await insertMessageAiRun({
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      promptVersion: INBOUND_CLASSIFICATION_PROMPT_VERSION,
      model,
      structuredOutput: stored,
      latencyMs: latency,
      error: errorText,
    });

    await supabase
      .from("conversations")
      .update({
        sentiment: "unknown",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.conversationId)
      .eq("dealership_id", input.dealershipId);

    await applySentimentEscalation({
      supabase,
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      inboundBody: input.customerMessageBody,
      ai: null,
    });

    const canFallbackAutoReply =
      convRow.ok &&
      isWebChatAutomatedTriageUnblocked(
        convRow.data.channel,
        convRow.data.ai_enabled,
        convRow.data.status,
        convRow.data.metadata
      ) && !humanControlled;

    if (canFallbackAutoReply) {
      let fallbackReply = stored.parsed.safe_draft_reply.trim();
      if (HOURS_QUESTION_RE.test(input.customerMessageBody)) {
        const dealer = await supabase
          .from("dealerships")
          .select("timezone, business_hours")
          .eq("id", input.dealershipId)
          .maybeSingle();
        if (dealer.data && convRow.ok) {
          const cfg = parseBusinessHoursConfig(
            dealer.data.business_hours as import("@/integrations/supabase/database.types").Json,
            dealer.data.timezone
          );
          const live = evaluateLiveHours(
            cfg,
            convRow.data.department ?? "general",
            new Date()
          );
          const tzLabel = formatTimezoneShortLabel(live.timezone);
          fallbackReply = live.within_live_hours
            ? `We are open right now (${tzLabel}). If you tell me whether this is for sales or service, I can guide you right away.`
            : `We are currently closed (${tzLabel}). If you share whether this is for sales or service, I can help with the best next step and a teammate follow-up.`;
        }
      }
      if (fallbackReply.length > 0) {
        const distinctFallback = await webChatDistinctAiBody(
          supabase,
          input,
          fallbackReply
        );
        await createMessage(
          {
            dealershipId: input.dealershipId,
            conversationId: input.conversationId,
            senderType: "ai",
            body: distinctFallback,
            deliveryStatus: "sent",
            metadata: {
              source: "ai_autoreply_fallback_on_model_error",
              classification_message_id: input.messageId,
              model_error: errorText ?? "unknown",
              ...(distinctFallback !== fallbackReply
                ? { replaced_near_duplicate: true }
                : {}),
            },
          },
          supabase
        );
      }
      return ok(undefined);
    }

    if (!humanControlled) {
      await applyAiHumanEscalationStatus(
        supabase,
        input.dealershipId,
        input.conversationId,
        stored.escalate_to_human_effective,
        stored.rules_applied
      );
    }

    return ok(undefined);
  }

  const draftSafe = applyInboundDraftSafety(modelOutput);
  const classified = draftSafe.output;
  const canKeepAiLiveOnLowConfidence =
    convRow.ok &&
    isWebChatAutomatedTriageUnblocked(
      convRow.data.channel,
      convRow.data.ai_enabled,
      convRow.data.status,
      convRow.data.metadata
    );

  const rules: InboundClassificationStored["rules_applied"] = [];
  let effectiveEscalate = classified.escalate_to_human;

  if (draftSafe.redacted) {
    rules.push("unsafe_draft_redacted");
    effectiveEscalate = true;
  }
  if (classified.confidence < threshold) {
    rules.push("low_confidence");
    const hardEscalationSignals =
      draftSafe.redacted ||
      classified.sentiment === "negative" ||
      modelOutput.escalate_to_human;
    if (!canKeepAiLiveOnLowConfidence || hardEscalationSignals) {
      effectiveEscalate = true;
    }
  }
  if (classified.sentiment === "negative") {
    rules.push("negative_sentiment");
    effectiveEscalate = true;
  }
  if (modelOutput.escalate_to_human) {
    rules.push("model_escalation");
  }
  const earlyVehicleInterest =
    /\b(truck|suv|tundra|f-150|silverado|ram|tacoma|rogue|altima|want|looking for)\b/i.test(
      input.customerMessageBody
    ) &&
    !/\b(price|payment|person|manager|call me|human|today|now|angry)\b/i.test(
      input.customerMessageBody
    );
  if (hasHandoffLanguage(classified) && !earlyVehicleInterest) {
    rules.push("handoff_language");
    effectiveEscalate = true;
  }

  const afterHoursEnabled = env.AI_SERVICE_AFTER_HOURS_AUTOREPLY !== "false";
  const canAutoReplyInAiMode =
    convRow.ok &&
    isWebChatAutomatedTriageUnblocked(
      convRow.data.channel,
      convRow.data.ai_enabled,
      convRow.data.status,
      convRow.data.metadata
    );
  const canSendAfterHoursIntro =
    afterHoursEnabled &&
    convRow.ok &&
    convRow.data.channel === "web_chat" &&
    isAfterHoursWebChatIntake(convRow.data.metadata) &&
    !isWidgetAiIntroMessageSent(convRow.data.metadata);
  const shouldSendAutoReply = canAutoReplyInAiMode || canSendAfterHoursIntro;
  let generatedReplyBody: string | null = null;
  let generatedOfferId: string | null = null;

  const activeOffers = await loadOffersForAiContext(
    input.dealershipId,
    input.conversationDepartment as StaffDepartment,
    supabase
  );
  const offersPrompt = formatOffersForPrompt(activeOffers);
  const recentOfferIds = msgs.ok ? recentAiOfferIds(msgs.data) : [];

  if (
    shouldSendAutoReply &&
    !blockAiCustomerMessages &&
    !draftSafe.redacted &&
    convRow.ok &&
    convRow.data.channel !== "web_chat"
  ) {
    const extractedHints = extractProfileHintsFromText(input.customerMessageBody);
    const mergedProfile = mergeExtractedCustomerProfile({
      fromModel: {
        name: classified.customer_profile.name,
        email: classified.customer_profile.email,
        phoneE164: classified.customer_profile.phone_e164,
      },
      fromHeuristics: extractedHints,
    });
    let customerKnown: {
      display_name: string | null;
      email: string | null;
      phone_e164: string | null;
    } | null = null;
    if (convRow.data.customer_id) {
      const customerRes = await getCustomerById(
        input.dealershipId,
        convRow.data.customer_id,
        supabase
      );
      if (customerRes.ok) {
        customerKnown = customerRes.data;
      }
    }

    const missingProfileFields = profileFieldsStillMissing({
      displayName: customerKnown?.display_name ?? mergedProfile.name,
      email: customerKnown?.email ?? mergedProfile.email,
      phoneE164: customerKnown?.phone_e164 ?? mergedProfile.phoneE164,
      extracted: mergedProfile,
    });

    const generated = await generateConversationalReply({
      model,
      channel: input.channel,
      transcript,
      latestCustomerMessage: input.customerMessageBody,
      classification: classified,
      currentDepartment: input.conversationDepartment,
      missingProfileFields,
      activeOffersPrompt: offersPrompt,
      widgetIntakeTopic,
    });

    if (generated?.reply?.trim()) {
      const generatedSafe = applyInboundDraftSafety({
        ...classified,
        safe_draft_reply: generated.reply.trim(),
      });
      if (
        generatedSafe.redacted &&
        !rules.includes("unsafe_draft_redacted")
      ) {
        rules.push("unsafe_draft_redacted");
        effectiveEscalate = true;
      }

      generatedReplyBody = generatedSafe.output.safe_draft_reply.trim();
      const offerAllowed =
        generated.offerId && activeOffers.some((o) => o.id === generated.offerId);
      generatedOfferId =
        offerAllowed && !recentOfferIds.includes(generated.offerId!)
          ? generated.offerId!
          : null;
      if (generated.handoffNow) {
        if (!rules.includes("model_escalation")) {
          rules.push("model_escalation");
        }
        effectiveEscalate = true;
      } else if (
        hasHandoffLanguage({
          ...classified,
          safe_draft_reply: generatedReplyBody,
        })
      ) {
        if (!rules.includes("handoff_language")) {
          rules.push("handoff_language");
        }
        effectiveEscalate = true;
      }
    }
  } else if (
    shouldSendAutoReply &&
    !blockAiCustomerMessages &&
    !draftSafe.redacted &&
    convRow.ok &&
    convRow.data.channel === "web_chat"
  ) {
    const extractedHints = extractProfileHintsFromText(input.customerMessageBody);
    const mergedProfile = mergeExtractedCustomerProfile({
      fromModel: {
        name: classified.customer_profile.name,
        email: classified.customer_profile.email,
        phoneE164: classified.customer_profile.phone_e164,
      },
      fromHeuristics: extractedHints,
    });
    let customerKnown: {
      display_name: string | null;
      email: string | null;
      phone_e164: string | null;
    } | null = null;
    if (convRow.data.customer_id) {
      const customerRes = await getCustomerById(
        input.dealershipId,
        convRow.data.customer_id,
        supabase
      );
      if (customerRes.ok) {
        customerKnown = customerRes.data;
      }
    }
    const missingProfileFields = orderMissingProfileFields(
      profileFieldsStillMissing({
        displayName: customerKnown?.display_name ?? mergedProfile.name,
        email: customerKnown?.email ?? mergedProfile.email,
        phoneE164: customerKnown?.phone_e164 ?? mergedProfile.phoneE164,
        extracted: mergedProfile,
      })
    );
    generatedReplyBody = augmentWebChatDraftWithProfileAsk(
      classified.safe_draft_reply.trim(),
      missingProfileFields
    );
  }

  const stored: InboundClassificationStored = {
    prompt_version: INBOUND_CLASSIFICATION_PROMPT_VERSION,
    model,
    parsed: classified,
    escalate_to_human_effective: effectiveEscalate,
    rules_applied: rules,
    draft_safety: draftSafe.redacted
      ? { redacted: true, triggers: draftSafe.triggers }
      : undefined,
  };

  await insertMessageAiRun({
    dealershipId: input.dealershipId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    promptVersion: INBOUND_CLASSIFICATION_PROMPT_VERSION,
    model,
    structuredOutput: stored,
    latencyMs: latency,
    error: null,
  });

  const sentiment = mapSentimentToConversation(classified.sentiment);
  const extractedHints = extractProfileHintsFromText(input.customerMessageBody);
  const mergedProfile = mergeExtractedCustomerProfile({
    fromModel: {
      name: classified.customer_profile.name,
      email: classified.customer_profile.email,
      phoneE164: classified.customer_profile.phone_e164,
    },
    fromHeuristics: extractedHints,
  });

  const opportunityPatch =
    convRow.ok
      ? computeOpportunityScore({
          messageText: [transcript, input.customerMessageBody].filter(Boolean).join("\n"),
          classification: {
            intent: classified.intent,
            confidence: classified.confidence,
            urgency: classified.urgency,
            sentiment: classified.sentiment,
          },
          conversationMetadata: convRow.data.metadata,
          status: convRow.data.status,
          department: input.conversationDepartment as StaffDepartment,
        })
      : null;

  let customerKnown: {
    display_name: string | null;
    email: string | null;
    phone_e164: string | null;
  } | null = null;
  if (convRow.ok && convRow.data.customer_id) {
    const customerRes = await getCustomerById(
      input.dealershipId,
      convRow.data.customer_id,
      supabase
    );
    if (customerRes.ok) {
      customerKnown = customerRes.data;
    }
  }

  const missingProfileFields = profileFieldsStillMissing({
    displayName: customerKnown?.display_name ?? mergedProfile.name,
    email: customerKnown?.email ?? mergedProfile.email,
    phoneE164: customerKnown?.phone_e164 ?? mergedProfile.phoneE164,
    extracted: mergedProfile,
  });

  let metadataPatch: import("@/integrations/supabase/database.types").Json | undefined;
  if (convRow.ok) {
    let meta = convRow.data.metadata;
    if (opportunityPatch) {
      meta = mergeOpportunityMetadata(meta, opportunityPatch);
    }
    const insights = buildAiInsightsSnapshot({
      classified,
      opportunityScore: opportunityPatch?.score ?? 0,
      missingProfileFields,
    });
    meta = mergeAiInsightsMetadata(meta, insights);
    metadataPatch = meta;
  }

  if (
    convRow.ok &&
    classified.confidence >= DEPT_AUTO_ROUTE_MIN_CONFIDENCE &&
    classified.department !== convRow.data.department &&
    classified.department !== "general" &&
    (convRow.data.department === "general" ||
      convRow.data.department === input.conversationDepartment)
  ) {
    await updateConversationDepartment(
      input.dealershipId,
      input.conversationId,
      classified.department,
      { db: supabase }
    );
  }

  await supabase
    .from("conversations")
    .update({
      sentiment,
      ...(metadataPatch ? { metadata: metadataPatch } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.conversationId)
    .eq("dealership_id", input.dealershipId);

  if (convRow.ok && convRow.data.customer_id) {
    const profilePatch = normalizeProfilePatch({
      name: isPlaceholderCustomerName(customerKnown?.display_name)
        ? mergedProfile.name
        : undefined,
      email: customerKnown?.email?.trim() ? undefined : mergedProfile.email,
      phoneE164: customerKnown?.phone_e164?.trim()
        ? undefined
        : mergedProfile.phoneE164,
    });
    if (
      profilePatch.displayName !== undefined ||
      profilePatch.email !== undefined ||
      profilePatch.phoneE164 !== undefined
    ) {
      await updateCustomerProfile(
        {
          dealershipId: input.dealershipId,
          customerId: convRow.data.customer_id,
          displayName: profilePatch.displayName,
          email: profilePatch.email,
          phoneE164: profilePatch.phoneE164,
        },
        supabase
      );
      const attributedOfferId =
        readLastOfferedIdFromConversationMetadata(convRow.data.metadata) ??
        (msgs.ok ? lastAiOfferIdFromMessages(msgs.data, input.messageId) : null);
      if (
        attributedOfferId &&
        (profilePatch.phoneE164 !== undefined || profilePatch.email !== undefined)
      ) {
        await logOfferLeadIfAttributed({
          dealershipId: input.dealershipId,
          conversationId: input.conversationId,
          offerId: attributedOfferId,
        });
      }
    }
  }

  await applySentimentEscalation({
    supabase,
    dealershipId: input.dealershipId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    inboundBody: input.customerMessageBody,
    ai: {
      sentiment: classified.sentiment,
      confidence: classified.confidence,
    },
  });

  if (!humanControlled) {
    await applyAiHumanEscalationStatus(
      supabase,
      input.dealershipId,
      input.conversationId,
      effectiveEscalate,
      rules
    );
    if (convRow.ok && effectiveEscalate) {
      const attributedOfferId = readLastOfferedIdFromConversationMetadata(
        convRow.data.metadata
      );
      if (attributedOfferId) {
        await logOfferCompleteIfAttributed({
          dealershipId: input.dealershipId,
          conversationId: input.conversationId,
          offerId: attributedOfferId,
        });
      }
    }
  }

  /**
   * Post the model’s `safe_draft_reply` in web chat even when `effectiveEscalate` is true.
   * Escalation means “queue a human” — it must not produce a silent widget; the draft is already
   * safety-reviewed. (We still skip when `draftSafe.redacted` or `blockAiCustomerMessages`.)
   */
  if (
    shouldSendAutoReply &&
    !blockAiCustomerMessages &&
    convRow.ok &&
    convRow.data.channel === "web_chat"
  ) {
    let replyBody = draftSafe.redacted
      ? WEB_CHAT_CONTACT_FALLBACK
      : (generatedReplyBody ?? classified.safe_draft_reply).trim();
    if (replyBody.length === 0) {
      replyBody = WEB_CHAT_CONTACT_FALLBACK;
    }
    if (replyBody.length > 0) {
      const afterHoursOneShot = canSendAfterHoursIntro;
      const distinctBody = await webChatDistinctAiBody(supabase, input, replyBody);
      const aiMsg = await createMessage(
        {
          dealershipId: input.dealershipId,
          conversationId: input.conversationId,
          senderType: "ai",
          body: distinctBody,
          deliveryStatus: "sent",
          metadata: {
            source: afterHoursOneShot
              ? "ai_after_hours_service_intake"
              : "ai_web_chat_triage",
            classification_message_id: input.messageId,
            ...(effectiveEscalate ? { triage_escalation: true } : {}),
            ...(distinctBody !== replyBody ? { replaced_near_duplicate: true } : {}),
            ...(generatedOfferId ? { offered_lead_offer_id: generatedOfferId } : {}),
          },
        },
        supabase
      );
      if (generatedOfferId) {
        await logOfferViewIfPresent({
          dealershipId: input.dealershipId,
          conversationId: input.conversationId,
          offerId: generatedOfferId,
        });
        if (convRow.ok) {
          const meta = convRow.data.metadata;
          const base =
            meta && typeof meta === "object" && !Array.isArray(meta)
              ? { ...(meta as Record<string, unknown>) }
              : {};
          await supabase
            .from("conversations")
            .update({
              metadata: {
                ...base,
                last_offered_lead_offer_id: generatedOfferId,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", input.conversationId)
            .eq("dealership_id", input.dealershipId);
        }
      }
      if (aiMsg.ok && afterHoursOneShot) {
        await supabase
          .from("conversations")
          .update({
            metadata: withWidgetAiIntroMessageSent(convRow.data.metadata),
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.conversationId)
          .eq("dealership_id", input.dealershipId);
      }
    }
  }

  return ok(undefined);
}

/**
 * Fire-and-forget wrapper for inbound pipelines (never throws to caller).
 */
export function scheduleInboundClassification(
  input: Parameters<typeof runInboundClassification>[0]
): void {
  void runInboundClassification(input).catch((error) => {
    capturePipelineFailure("inbound_classification", error, {
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      messageId: input.messageId,
    });
  });
}
