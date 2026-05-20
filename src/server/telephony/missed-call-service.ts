import "server-only";

import type { Json } from "@/integrations/supabase/database.types";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { normalizeE164 } from "@/lib/phone/e164";
import { sendSystemSmsToCustomer } from "@/server/messaging/sms-system-outbound";
import {
  createConversation,
  findActiveSmsConversationForCustomer,
} from "@/server/data/conversations";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { getOrCreateCustomerByPhoneOrEmail } from "@/server/data/customers";
import { mergeConversationMetadata } from "@/server/telephony/conversation-metadata-merge";
import { err, ok, type Result } from "@/server/result";
import { getMissedCallFollowupSmsBody } from "@/server/telephony/missed-call-copy";
import { resolveDealershipIdFromDialedNumber } from "@/server/telephony/resolve-dealership-by-line";
import type { MissedCallFlowState, NormalizedMissedCallEvent } from "@/server/telephony/types";

function buildDedupeKey(event: NormalizedMissedCallEvent): string | null {
  if (!event.externalCallId?.trim()) {
    return null;
  }
  return `${event.provider}:${event.externalCallId.trim()}`;
}

async function tryClaimMissedCallDedupe(
  dealershipId: string,
  dedupeKey: string
): Promise<Result<boolean>> {
  const supabase = createSupabaseAdminClient();
  const ins = await supabase.from("telephony_event_dedupe").insert({
    dedupe_key: dedupeKey,
    dealership_id: dealershipId,
    kind: "missed_call",
  });

  if (ins.error) {
    if (ins.error.code === "23505") {
      return ok(false);
    }
    return err("DEDUPE_ERROR", ins.error.message);
  }
  return ok(true);
}

function trimRawPayload(raw: Json | Record<string, unknown> | null | undefined): Json {
  if (raw == null) {
    return {};
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const s = JSON.stringify(raw);
    if (s.length > 8000) {
      return { truncated: true, preview: s.slice(0, 4000) } as unknown as Json;
    }
  }
  return raw as Json;
}

export type MissedCallHandleOk = {
  dealershipId: string;
  conversationId: string;
  skippedDuplicate: boolean;
  smsDispatched: boolean;
};

/**
 * Entry point for missed-call automation: ensures SMS thread + sends follow-up SMS.
 * Idempotent when `externalCallId` is supplied (dedupe table).
 */
export async function handleMissedCallEvent(
  event: NormalizedMissedCallEvent
): Promise<Result<MissedCallHandleOk>> {
  const caller = normalizeE164(event.callerE164);

  let dealershipId: string;
  if (event.dealershipId?.trim()) {
    dealershipId = event.dealershipId.trim();
  } else if (event.dialedE164?.trim()) {
    const resolved = await resolveDealershipIdFromDialedNumber(event.dialedE164.trim());
    if (!resolved.ok) {
      return resolved;
    }
    dealershipId = resolved.data;
  } else {
    return err(
      "VALIDATION",
      "Provide dealershipId or dialedE164 to route the missed-call event."
    );
  }

  const dedupeKey = buildDedupeKey(event);
  if (dedupeKey) {
    const claimed = await tryClaimMissedCallDedupe(dealershipId, dedupeKey);
    if (!claimed.ok) {
      return claimed;
    }
    if (!claimed.data) {
      const supabase = createSupabaseAdminClient();
      const cust = await getOrCreateCustomerByPhoneOrEmail(
        { dealershipId, phoneE164: caller },
        supabase
      );
      let conversationId = "";
      if (cust.ok) {
        const conv = await findActiveSmsConversationForCustomer(
          dealershipId,
          cust.data.id,
          supabase
        );
        if (conv.ok && conv.data) {
          conversationId = conv.data.id;
        }
      }
      return ok({
        dealershipId,
        conversationId,
        skippedDuplicate: true,
        smsDispatched: false,
      });
    }
  }

  const supabase = createSupabaseAdminClient();

  const cust = await getOrCreateCustomerByPhoneOrEmail(
    {
      dealershipId,
      phoneE164: caller,
      displayName: null,
    },
    supabase
  );
  if (!cust.ok) {
    return cust;
  }

  const customerId = cust.data.id;
  const phone = cust.data.phone_e164?.trim();
  if (!phone) {
    return err("NO_PHONE", "Customer record has no phone for SMS follow-up.");
  }

  const existingConv = await findActiveSmsConversationForCustomer(
    dealershipId,
    customerId,
    supabase
  );
  if (!existingConv.ok) {
    return existingConv;
  }

  const now = new Date().toISOString();
  const flow: MissedCallFlowState = {
    phase: "awaiting_department",
    provider: event.provider,
    last_external_call_id: event.externalCallId?.trim() ?? undefined,
    started_at: now,
  };

  let conversationId: string;
  let isNew = false;

  if (existingConv.data) {
    conversationId = existingConv.data.id;
    const prevMeta = existingConv.data.metadata;
    const prevSms =
      typeof prevMeta === "object" &&
      prevMeta !== null &&
      !Array.isArray(prevMeta) &&
      typeof (prevMeta as { sms?: unknown }).sms === "object" &&
      (prevMeta as { sms?: Record<string, unknown> }).sms !== null
        ? (prevMeta as { sms: Record<string, unknown> }).sms
        : {};

    const mergedMeta = mergeConversationMetadata(prevMeta, {
      missed_call_flow: flow,
      sms: {
        ...prevSms,
        last_missed_call_at: now,
      },
    });

    const touch = await supabase
      .from("conversations")
      .update({
        metadata: mergedMeta,
        updated_at: now,
      })
      .eq("dealership_id", dealershipId)
      .eq("id", conversationId)
      .select()
      .single();

    if (touch.error || !touch.data) {
      return err("CONVERSATION_UPDATE_FAILED", touch.error?.message ?? "Update failed");
    }
  } else {
    const created = await createConversation(
      {
        dealershipId,
        customerId,
        channel: "sms",
        department: "general",
        title: `Missed call — ${caller}`,
        metadata: {
          sms: { source: "missed_call_follow_up" },
          missed_call_flow: flow,
        },
      },
      supabase
    );

    if (!created.ok) {
      return created;
    }

    conversationId = created.data.id;
    isNew = true;

    const createdEv = await insertConversationEvent(supabase, {
      conversation_id: conversationId,
      event_type: "conversation_created",
      actor_user_id: null,
      payload: {
        source: "telephony",
        channel: "sms",
        kind: "missed_call_conversation",
        provider: event.provider,
        raw: trimRawPayload(event.raw ?? null),
      },
    });

    if (!createdEv.ok) {
      return createdEv;
    }
  }

  const mcEv = await insertConversationEvent(supabase, {
    conversation_id: conversationId,
    event_type: "conversation_updated",
    actor_user_id: null,
    payload: {
      kind: "missed_call_follow_up_initiated",
      provider: event.provider,
      new_conversation: isNew,
      external_call_id: event.externalCallId ?? null,
      raw: trimRawPayload(event.raw ?? null),
    },
  });

  if (!mcEv.ok) {
    return mcEv;
  }

  const body = getMissedCallFollowupSmsBody();

  const sent = await sendSystemSmsToCustomer({
    dealershipId,
    conversationId,
    customerPhoneE164: phone,
    body,
    metadata: {
      missed_call_automation: true,
      template: "missed_call_department_prompt",
    },
  });

  if (!sent.ok) {
    return err(sent.error.code, sent.error.message);
  }

  return ok({
    dealershipId,
    conversationId,
    skippedDuplicate: false,
    smsDispatched: true,
  });
}
