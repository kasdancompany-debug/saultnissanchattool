import "server-only";

import { createTwilioClient } from "@/integrations/twilio/client";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { createMessage } from "@/server/data/messages";
import { err, ok, type Result } from "@/server/result";
import type { MessageRow } from "@/server/data/messages";

/**
 * Sends an automated SMS and records it as a **system** message on the thread.
 * Used for missed-call follow-ups and similar flows (not staff-authored).
 */
export async function sendSystemSmsToCustomer(params: {
  dealershipId: string;
  conversationId: string;
  customerPhoneE164: string;
  body: string;
  metadata: Record<string, unknown>;
}): Promise<Result<MessageRow>> {
  const supabase = createSupabaseAdminClient();

  const inserted = await createMessage(
    {
      dealershipId: params.dealershipId,
      conversationId: params.conversationId,
      senderType: "system",
      body: params.body,
      deliveryStatus: "queued",
      metadata: {
        ...params.metadata,
        automation: {
          kind: "system_sms",
        },
      },
    },
    supabase
  );

  if (!inserted.ok) {
    return inserted;
  }

  let message = inserted.data;

  try {
    const client = createTwilioClient();
    const { sid } = await client.sendSms({
      to: params.customerPhoneE164,
      body: params.body,
    });

    const sent = await supabase
      .from("messages")
      .update({
        delivery_status: "sent",
        twilio_outbound_sid: sid,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(typeof message.metadata === "object" && message.metadata !== null
            ? (message.metadata as Record<string, unknown>)
            : {}),
          transport: {
            provider: "twilio",
            phase: "sent",
            twilio_message_sid: sid,
          },
        },
      })
      .eq("id", message.id)
      .select()
      .single();

    if (sent.error || !sent.data) {
      return err("MESSAGE_UPDATE_FAILED", sent.error?.message ?? "Update failed");
    }

    message = sent.data;
    return ok(message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Twilio send failed";
    const failed = await supabase
      .from("messages")
      .update({
        delivery_status: "failed",
        updated_at: new Date().toISOString(),
        metadata: {
          ...(typeof message.metadata === "object" && message.metadata !== null
            ? (message.metadata as Record<string, unknown>)
            : {}),
          transport: {
            provider: "twilio",
            phase: "failed",
            error: msg,
          },
        },
      })
      .eq("id", message.id)
      .select()
      .single();

    if (failed.error || !failed.data) {
      return err("TWILIO_ERROR", msg);
    }
    return ok(failed.data);
  }
}
