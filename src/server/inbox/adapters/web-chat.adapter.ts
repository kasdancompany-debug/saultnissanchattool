import "server-only";

import type { TypedSupabaseClient } from "@/server/db/server-client";
import { getConversationRowById } from "@/server/data/conversations";
import { applyInboundMessage } from "@/server/messaging/inbound/apply-inbound-message";
import type {
  InboundNormalizedCore,
  NormalizedInboundMessage,
} from "@/server/messaging/inbound/normalized-inbound-message";
import { err, ok, type Result } from "@/server/result";

import type { InboundApplyResult, InboundChannelAdapter } from "../channel-adapter";
import { parseValidateNormalize } from "../channel-adapter";

export type WebChatInboundAdapterRaw = {
  dealershipId: string;
  conversationId: string;
  body: string;
  customerDisplayName?: string | null;
};

function isWebChatInboundRaw(raw: unknown): raw is WebChatInboundAdapterRaw {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return false;
  }
  const o = raw as Record<string, unknown>;
  return (
    typeof o.dealershipId === "string" &&
    typeof o.conversationId === "string" &&
    typeof o.body === "string"
  );
}

export const webChatInboundAdapter: InboundChannelAdapter<WebChatInboundAdapterRaw> = {
  channelKey: "web_widget",

  parseWebhookPayload(raw: unknown): Result<WebChatInboundAdapterRaw> {
    if (!isWebChatInboundRaw(raw)) {
      return err("VALIDATION", "Invalid web chat inbound payload.");
    }
    return ok(raw);
  },

  validateProviderRequest(parsed: WebChatInboundAdapterRaw): Result<void> {
    if (!parsed.body.trim()) {
      return err("VALIDATION", "Message body cannot be empty.");
    }
    return ok(undefined);
  },

  normalize(parsed: WebChatInboundAdapterRaw): Result<InboundNormalizedCore> {
    const externalMessageId = crypto.randomUUID();
    const display = parsed.customerDisplayName?.trim() || "Website visitor";
    return ok({
      externalMessageId,
      channel: "web_chat",
      customerDisplayName: display,
      text: parsed.body.trim(),
      timestamp: new Date().toISOString(),
      rawPayload: {
        source: "web_widget",
        conversation_id: parsed.conversationId,
        dealership_id: parsed.dealershipId,
      },
    });
  },

  async ingest(raw: unknown, db: TypedSupabaseClient): Promise<Result<InboundApplyResult>> {
    const chain = parseValidateNormalize(webChatInboundAdapter, raw);
    if (!chain.ok) {
      return chain;
    }
    const { parsed, core } = chain.data;

    const conv = await getConversationRowById(parsed.dealershipId, parsed.conversationId, db);
    if (!conv.ok) {
      return conv;
    }
    if (conv.data.channel !== "web_chat") {
      return err("NOT_FOUND", "Conversation not found.");
    }

    const normalized: NormalizedInboundMessage = {
      ...core,
      dealershipId: parsed.dealershipId,
      targetConversationId: parsed.conversationId,
    };

    const applied = await applyInboundMessage(normalized, db);
    if (!applied.ok) {
      return applied;
    }

    if (applied.data.duplicate) {
      return ok({ kind: "duplicate" });
    }

    return ok({
      kind: "inserted",
      dealershipId: parsed.dealershipId,
      conversationId: parsed.conversationId,
      messageId: applied.data.message.id,
      createdAt: applied.data.message.created_at,
    });
  },
};
