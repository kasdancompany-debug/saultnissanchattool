import "server-only";

import { twilioServerEnvSchema, type TwilioServerEnv } from "@/lib/env/schema";

/**
 * Validates and returns **only** Twilio server variables (no OpenAI, Supabase service role, etc.).
 * Use this from Twilio webhooks, outbound SMS, and dealership line resolution so missing Twilio
 * config fails with Zod messages pointing at `TWILIO_*` keys — without requiring unrelated secrets.
 *
 * | Variable | Where used |
 * |----------|------------|
 * | `TWILIO_ACCOUNT_SID` | `createTwilioClient` → Twilio SDK constructor for REST sends. |
 * | `TWILIO_AUTH_TOKEN` | SDK auth + `validateTwilioWebhookSignature` for inbound/status webhooks. |
 * | `TWILIO_PHONE_NUMBER` | Default `From` on outbound SMS; fallback match for inbound `To` in {@link resolveDealershipIdFromDialedNumber}. |
 *
 * Optional `TWILIO_STATUS_CALLBACK_URL` is read separately in `createTwilioClient` (not part of this parse).
 *
 * @throws {import("zod").ZodError} when any required value is missing or `TWILIO_PHONE_NUMBER` is not E.164.
 */
export function getTwilioServerEnv(): TwilioServerEnv {
  return twilioServerEnvSchema.parse({
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  });
}
