import "server-only";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { isWebChatAutomatedTriageUnblocked } from "@/lib/conversation/control-metadata";
import { readWidgetIntakeIntent } from "@/lib/conversation/widget-metadata";
import {
  aggregateProfileHintsFromTexts,
  contactFieldsStillMissing,
  extractProfileHintsFromText,
  isPlaceholderCustomerName,
  mergeExtractedCustomerProfile,
} from "@/lib/conversation/extract-profile-hints";
import { syncCustomerProfileFromInboundMessage } from "@/server/conversation/sync-customer-profile-from-inbound";
import { getInboundClassificationEnv } from "@/lib/env/inbound-classification-config";
import { getConversationRowById } from "@/server/data/conversations";
import { getCustomerById } from "@/server/data/customers";
import { createMessage, getMessagesForConversation } from "@/server/data/messages";
import { ensureDistinctAssistantReply } from "@/lib/ai/assistant-reply-dedupe";
import { openaiChatCompletionsJson } from "@/server/ai/openai-chat";
import {
  buildContextualWidgetReply,
  parseWidgetReplyJson,
} from "@/server/widget/widget-contextual-reply";

import type { WidgetInboundAiJob } from "@/server/widget/widget-public-service";

type WidgetAiReplyMessage = {
  id: string;
  body: string;
  created_at: string;
  sender: "ai";
};

const OPENAI_TIMEOUT_MS = 22_000;

async function openaiWithTimeout(
  params: Parameters<typeof openaiChatCompletionsJson>[0]
): Promise<Awaited<ReturnType<typeof openaiChatCompletionsJson>>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    return await openaiChatCompletionsJson(params, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function buildTranscript(
  rows: { sender_type: string; body: string | null }[]
): string {
  const lines: string[] = [];
  for (const m of rows) {
    const body = (m.body ?? "").trim();
    if (!body) continue;
    const label =
      m.sender_type === "customer"
        ? "Customer"
        : m.sender_type === "ai"
          ? "Assistant"
          : m.sender_type === "staff"
            ? "Staff"
            : "System";
    lines.push(`${label}: ${body}`);
  }
  const text = lines.join("\n");
  return text.length > 6000 ? text.slice(-6000) : text;
}

function orderMissing(fields: string[]): string[] {
  const priority = ["phone", "name"] as const;
  return priority.filter((f) => fields.includes(f));
}

function formatPhoneForPrompt(phoneE164: string | null | undefined): string | null {
  const raw = phoneE164?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

/**
 * Single OpenAI call for website widget — reliable, customer-facing, collects contact info.
 */
export async function runWidgetAssistantReply(
  job: WidgetInboundAiJob
): Promise<WidgetAiReplyMessage | null> {
  if (job.channel !== "web_chat") {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const conv = await getConversationRowById(
    job.dealershipId,
    job.conversationId,
    supabase
  );
  if (
    !conv.ok ||
    !isWebChatAutomatedTriageUnblocked(
      conv.data.channel,
      conv.data.ai_enabled,
      conv.data.status,
      conv.data.metadata
    )
  ) {
    return null;
  }

  await syncCustomerProfileFromInboundMessage(
    {
      dealershipId: job.dealershipId,
      conversationId: job.conversationId,
      latestCustomerText: job.customerMessageBody,
    },
    supabase
  );

  const existing = await getMessagesForConversation(
    job.dealershipId,
    job.conversationId,
    { limit: 40, db: supabase }
  );
  if (existing.ok) {
    const idx = existing.data.findIndex((m) => m.id === job.messageId);
    if (idx >= 0 && existing.data.slice(idx + 1).some((m) => m.sender_type === "ai")) {
      const aiRow = existing.data.slice(idx + 1).find((m) => m.sender_type === "ai");
      if (aiRow) {
        return {
          id: aiRow.id,
          body: aiRow.body,
          created_at: aiRow.created_at,
          sender: "ai",
        };
      }
    }
  }

  const topic = readWidgetIntakeIntent(conv.data.metadata);
  const customerBodies = existing.ok
    ? existing.data
        .filter((m) => m.sender_type === "customer")
        .map((m) => (m.body ?? "").trim())
        .filter(Boolean)
    : [job.customerMessageBody];
  const threadText = customerBodies.join("\n");
  const latestHints = extractProfileHintsFromText(job.customerMessageBody);
  const threadHints = aggregateProfileHintsFromTexts(customerBodies);
  const lastAssistantMessage = existing.ok
    ? [...existing.data]
        .reverse()
        .find((m) => m.sender_type === "ai")?.body ?? null
    : null;

  let customerKnown: {
    display_name: string | null;
    email: string | null;
    phone_e164: string | null;
  } | null = null;

  if (conv.data.customer_id) {
    const cust = await getCustomerById(
      job.dealershipId,
      conv.data.customer_id,
      supabase
    );
    if (cust.ok) {
      customerKnown = cust.data;
    }
  }

  const merged = mergeExtractedCustomerProfile({
    fromModel: threadHints,
    fromHeuristics: latestHints,
  });
  const missingContact = orderMissing(
    contactFieldsStillMissing({
      displayName: customerKnown?.display_name,
      phoneE164: customerKnown?.phone_e164,
      extracted: merged,
    })
  );

  const knownName =
    merged.name?.trim() ||
    (!isPlaceholderCustomerName(customerKnown?.display_name)
      ? customerKnown?.display_name?.trim()
      : null) ||
    null;
  const knownPhone =
    merged.phoneE164?.trim() || customerKnown?.phone_e164?.trim() || null;
  const knownPhoneDisplay = formatPhoneForPrompt(knownPhone);

  let replyText = buildContextualWidgetReply({
    customerMessage: job.customerMessageBody,
    threadText,
    department: job.conversationDepartment,
    topic,
    hints: merged,
    missingAfterHints: missingContact,
    knownDisplayName: knownName ?? customerKnown?.display_name,
    knownPhoneE164: knownPhone ?? customerKnown?.phone_e164,
    lastAssistantMessage,
  });
  let replySource: "heuristic" | "llm" = "heuristic";

  try {
    const env = getInboundClassificationEnv();
    const model = env.AI_MODEL.trim() || "gpt-4o-mini";
    const transcript = existing.ok ? buildTranscript(existing.data) : "";

    const topicLine = topic
      ? `Visitor selected topic: ${topic.replace(/_/g, " ")}.\n`
      : "";

    const contactNote =
      missingContact.length === 0
        ? `Customer contact on file${knownName ? `: ${knownName}` : ""}${knownPhoneDisplay ? `, ${knownPhoneDisplay}` : ""}. Use their first name when appropriate. Thank them and move forward (appointment timing, vehicle details, etc.). Do NOT ask for name or phone again.`
        : `Still need: ${missingContact.join(", ")}. Ask naturally; prefer phone first.`;

    const completion = await openaiWithTimeout({
      model,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: `You are the Sault Nissan website chat assistant. Reply in 1-3 short sentences.
- Reference the customer's exact words (vehicle, service need, trade-in, appointment, etc.).
- No pricing, payments, approvals, or guaranteed availability.
- ${contactNote}
- Do not repeat a previous assistant question if the customer already answered it.
- Do not say a teammate already took over unless they asked for a person.
Return JSON only: {"reply":"<text>"}`,
        },
        {
          role: "user",
          content: `${topicLine}Department: ${job.conversationDepartment}
Transcript:
${transcript || "(new chat)"}

Latest customer message:
"""
${job.customerMessageBody}
"""`,
        },
      ],
    });

    const llmReply = parseWidgetReplyJson(completion.content);
    if (llmReply) {
      replyText = llmReply;
      replySource = "llm";
    }
  } catch (error) {
    console.error("[widget] runWidgetAssistantReply OpenAI failed", error);
  }

  replyText = ensureDistinctAssistantReply({
    proposed: replyText,
    lastAssistantMessage,
    latestCustomerMessage: job.customerMessageBody,
  });

  const aiMsg = await createMessage(
    {
      dealershipId: job.dealershipId,
      conversationId: job.conversationId,
      senderType: "ai",
      body: replyText,
      deliveryStatus: "sent",
      metadata: {
        source:
          replySource === "llm"
            ? "ai_widget_assistant"
            : "ai_widget_assistant_heuristic",
        classification_message_id: job.messageId,
      },
    },
    supabase
  );

  if (!aiMsg.ok) {
    return null;
  }

  return {
    id: aiMsg.data.id,
    body: aiMsg.data.body,
    created_at: aiMsg.data.created_at,
    sender: "ai",
  };
}
