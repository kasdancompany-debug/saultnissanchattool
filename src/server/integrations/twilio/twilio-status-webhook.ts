import "server-only";

import { ZodError } from "zod";

import { buildTwilioMisconfiguredMessage } from "@/lib/env/messages";
import { getTwilioServerEnv } from "@/lib/env/twilio-server";
import { captureServerException } from "@/lib/observability/server-capture";
import { httpStatusForServiceError } from "@/lib/http/map-result-to-http-status";
import { parseTwilioWebhookFormBody } from "@/server/integrations/twilio/parse-webhook-form";
import { applyTwilioMessageStatus } from "@/server/integrations/twilio/apply-status-callback";
import { validateTwilioWebhookSignature } from "@/server/integrations/twilio/validate-request";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST handler for Twilio **message status** callbacks (`/api/webhooks/twilio/status`).
 *
 * - Validates `X-Twilio-Signature` using `TWILIO_AUTH_TOKEN`.
 * - Delegates to {@link applyTwilioMessageStatus} (provider mapping + DB updates + optional audit event).
 *
 * **Retries:** Twilio may POST the same status more than once. Updates are merged into `metadata.transport`
 * and **`delivery_status`** only moves forward via mapping; duplicate terminal callbacks do not emit
 * another event unless the stored `delivery_status` actually changes.
 *
 * **Missing message:** returns **200** with an empty body so Twilio does not retry forever when the SID
 * is unknown (e.g. old data or non-app sends).
 */
export async function handleTwilioStatusCallbackPost(request: Request): Promise<Response> {
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
    result = await applyTwilioMessageStatus(raw);
  } catch (error) {
    captureServerException(error, { route: "POST /api/webhooks/twilio/status" });
    return new Response("Internal Server Error", { status: 500 });
  }

  if (!result.ok) {
    const status = httpStatusForServiceError(result.error.code);
    return new Response(result.error.message, { status });
  }

  return new Response(null, { status: 200 });
}

export { handleTwilioStatusCallbackPost as POST };
