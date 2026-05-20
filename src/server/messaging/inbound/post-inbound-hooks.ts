import "server-only";

import type { TypedSupabaseClient } from "@/server/db/server-client";
import { getConversationRowById } from "@/server/data/conversations";
import { scheduleInboundClassification } from "@/server/ai/run-inbound-classification";
import { tryApplyMissedCallDepartmentReply } from "@/server/telephony/missed-call-inbound-hook";

import type { NormalizedInboundMessage } from "./normalized-inbound-message";

/**
 * Channel-specific side effects after a customer message is stored.
 * Inbox UI never calls this — only server inbound adapters / `applyInboundMessage` orchestration.
 */
export async function runPostInboundMessageHooks(input: {
  db: TypedSupabaseClient;
  dealershipId: string;
  conversationId: string;
  messageId: string;
  normalized: NormalizedInboundMessage;
}): Promise<void> {
  if (input.normalized.channel === "sms") {
    await tryApplyMissedCallDepartmentReply({
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      inboundCustomerMessageBody: input.normalized.text,
    });
  }

  const conv = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    input.db
  );
  if (conv.ok) {
    scheduleInboundClassification({
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      customerMessageBody: input.normalized.text,
      channel: conv.data.channel,
      conversationDepartment: conv.data.department,
    });
  }
}
