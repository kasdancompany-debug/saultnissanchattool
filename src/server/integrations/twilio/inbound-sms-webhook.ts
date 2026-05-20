import "server-only";

import { ZodError } from "zod";

import { buildTwilioMisconfiguredMessage } from "@/lib/env/messages";
import { getTwilioServerEnv } from "@/lib/env/twilio-server";
import { captureServerException } from "@/lib/observability/server-capture";

import { parseTwilioWebhookFormBody } from "@/server/integrations/twilio/parse-webhook-form";
import { processTwilioInboundSms } from "@/server/integrations/twilio/persist-inbound-sms";
import { validateTwilioWebhookSignature } from "@/server/integrations/twilio/validate-request";
import { twilioEmptyTwiMlResponse } from "@/server/webhooks/twilio/twiml";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST handler for Twilio inbound SMS (`/api/webhooks/twilio/inbound` and legacy `/sms`).
 *
 * Flow (no inbox business rules here — those live in {@link processTwilioInboundSms} → `applyInboundMessage`):
 * 1. Read `TWILIO_AUTH_TOKEN` for signature verification.
 * 2. Parse `application/x-www-form-urlencoded` body to a flat field map.
 * 3. Validate `X-Twilio-Signature` against the exact public URL Twilio called.
 * 4. Normalize + persist via {@link processTwilioInboundSms} (adapter → `applyInboundMessage`).
 * 5. Return **HTTP 200** + empty TwiML on success (Twilio contract for SMS inbound).
 *
 * **Idempotency:** Twilio may retry webhooks. `MessageSid` is stored as `messages.twilio_inbound_sid` and
 * deduplicated before insert; a replay yields `{ duplicate: true }` and still **200 + TwiML** so Twilio stops retrying.
 *
 * **Assumptions**
 * - Next exposes the webhook body as `FormData` (standard for App Router `POST`).
 * - `validateTwilioWebhookSignature` uses the same host/scheme/path Twilio used (proxy headers in `getTwilioWebhookPublicUrl`).
 * - `UNKNOWN_DEALERSHIP` returns 200 TwiML anyway so a misconfigured line does not cause infinite Twilio retries with 4xx/5xx.
 */
export async function handleTwilioInboundSmsPost(request: Request): Promise<Response> {
  let authToken: string;
  try {
    authToken = getTwilioServerEnv().TWILIO_AUTH_TOKEN;
  } catch (e) {
    if (e instanceof ZodError) {
      return new Response(buildTwilioMisconfiguredMessage(e), { status: 503 });
    }
    return new Response("Twilio environment is unavailable.", { status: 503 });
  }

  const signature = request.headers.get("x-twilio-signature");
  const form = await request.formData();
  const raw = parseTwilioWebhookFormBody(form);

  const valid = validateTwilioWebhookSignature(authToken, signature, request, raw);
  if (!valid) {
    return new Response("Forbidden", { status: 403 });
  }

  let result;
  try {
    result = await processTwilioInboundSms(raw);
  } catch (error) {
    captureServerException(error, { route: "POST /api/webhooks/twilio/inbound" });
    return new Response("Internal Server Error", { status: 500 });
  }

  if (!result.ok) {
    if (result.error.code === "UNKNOWN_DEALERSHIP") {
      return twilioEmptyTwiMlResponse();
    }
    if (result.error.code === "VALIDATION") {
      return twilioEmptyTwiMlResponse();
    }
    captureServerException(new Error(result.error.message), {
      route: "POST /api/webhooks/twilio/inbound",
      code: result.error.code,
    });
    return new Response(result.error.message, { status: 500 });
  }

  return twilioEmptyTwiMlResponse();
}

/** App Router entry — same implementation as {@link handleTwilioInboundSmsPost}. */
export { handleTwilioInboundSmsPost as POST };
