/**
 * Integration test: Twilio-shaped inbound SMS through {@link processTwilioInboundSms}
 * (adapter → `applyInboundMessage`). Requires a real Supabase project (local or dev).
 *
 * @see package.json script `test:twilio-inbound`
 * @see test/vitest.setup.ts for `.env.local` loading
 *
 * Safety: suite skipped unless `DEV_TWILIO_INBOUND_PIPELINE_TEST_ALLOW=1`.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/supabase";

import { processTwilioInboundSms } from "@/server/integrations/twilio/persist-inbound-sms";

const SEED_TAG = "dev_twilio_inbound_pipeline_v1";

const allow = process.env.DEV_TWILIO_INBOUND_PIPELINE_TEST_ALLOW === "1";

function twilioForm(input: {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
}): Record<string, string> {
  return {
    MessageSid: input.MessageSid,
    AccountSid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    From: input.From,
    To: input.To,
    Body: input.Body,
    NumMedia: "0",
    DateSent: new Date().toISOString(),
  };
}

describe.skipIf(!allow)("Twilio inbound pipeline (integration)", () => {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const supabase = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runId = Date.now().toString(36);
  const slug = `dev-twilio-pipeline-${runId}`;
  const toLine = "+15551230001";
  const fromCustomer = "+15559876543";

  let dealershipId: string | null = null;

  afterAll(async () => {
    if (dealershipId) {
      await supabase.from("dealerships").delete().eq("id", dealershipId);
    }
  });

  it("creates customer, conversation, message; dedupes replay; bumps last_message_at", async () => {
    const { data: dealership, error: dealErr } = await supabase
      .from("dealerships")
      .insert({
        name: "Dev Twilio inbound pipeline (vitest)",
        slug,
        timezone: "America/Toronto",
        metadata: { dev_seed: SEED_TAG },
      })
      .select("id")
      .single();

    expect(dealErr).toBeNull();
    expect(dealership).toBeTruthy();
    dealershipId = dealership!.id;

    const { error: chErr } = await supabase.from("dealership_channel_accounts").insert({
      dealership_id: dealershipId,
      provider: "twilio_sms",
      external_account_id: toLine,
      display_label: "Vitest inbound line",
      is_active: true,
      metadata: { dev_seed: SEED_TAG },
    });
    expect(chErr).toBeNull();

    const messageSid1 = `SM${randomBytes(16).toString("hex")}`;
    const form1 = twilioForm({
      MessageSid: messageSid1,
      From: fromCustomer,
      To: toLine,
      Body: "First inbound SMS for pipeline test.",
    });

    const first = await processTwilioInboundSms(form1);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.data.duplicate).toBe(false);
    if (first.data.duplicate) {
      return;
    }

    const conversationId = first.data.conversationId;
    const messageId1 = first.data.messageId;

    const { data: custRows, error: custErr } = await supabase
      .from("customers")
      .select("id, phone_e164")
      .eq("dealership_id", dealershipId)
      .eq("phone_e164", fromCustomer);

    expect(custErr).toBeNull();
    expect(custRows?.length).toBe(1);

    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, channel, customer_id, last_message_at")
      .eq("id", conversationId)
      .single();

    expect(convErr).toBeNull();
    expect(conv?.channel).toBe("sms");
    expect(conv?.customer_id).toBe(custRows![0].id);

    const { data: msg1, error: msgErr } = await supabase
      .from("messages")
      .select("id, twilio_inbound_sid")
      .eq("id", messageId1)
      .single();

    expect(msgErr).toBeNull();
    expect(msg1?.twilio_inbound_sid).toBe(messageSid1);

    const lastAtAfterFirst = conv!.last_message_at;

    const dup = await processTwilioInboundSms(form1);
    expect(dup.ok).toBe(true);
    if (!dup.ok) {
      return;
    }
    expect(dup.data.duplicate).toBe(true);
    if (!dup.data.duplicate) {
      return;
    }

    const { count: countAfterDup } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    expect(countAfterDup).toBe(1);

    const { data: convAfterDup } = await supabase
      .from("conversations")
      .select("last_message_at")
      .eq("id", conversationId)
      .single();

    expect(convAfterDup?.last_message_at).toBe(lastAtAfterFirst);

    await new Promise((r) => setTimeout(r, 50));

    const messageSid2 = `SM${randomBytes(16).toString("hex")}`;
    const form2 = twilioForm({
      MessageSid: messageSid2,
      From: fromCustomer,
      To: toLine,
      Body: "Second inbound SMS — same thread.",
    });

    const second = await processTwilioInboundSms(form2);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.data.duplicate).toBe(false);
    if (second.data.duplicate) {
      return;
    }

    const { count: countFinal } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    expect(countFinal).toBe(2);

    const { data: convFinal } = await supabase
      .from("conversations")
      .select("last_message_at")
      .eq("id", conversationId)
      .single();

    expect(convFinal?.last_message_at).toBeTruthy();
    expect(new Date(convFinal!.last_message_at!).getTime()).toBeGreaterThan(
      new Date(lastAtAfterFirst!).getTime()
    );
  });
});
