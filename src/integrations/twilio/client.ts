import "server-only";

import twilio from "twilio";

import { getTwilioServerEnv } from "@/lib/env/twilio-server";

export interface TwilioSmsSendInput {
  to: string;
  body: string;
  /** Override `from` number; defaults to `TWILIO_PHONE_NUMBER`. */
  from?: string;
}

export interface TwilioClient {
  sendSms(input: TwilioSmsSendInput): Promise<{ sid: string }>;
}

/**
 * Twilio is only used on the server. Construct per request or in a Route Handler / Server Action.
 */
export function createTwilioClient(): TwilioClient {
  const env = getTwilioServerEnv();
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  const fromNumber = env.TWILIO_PHONE_NUMBER;

  const statusCallback =
    process.env.TWILIO_STATUS_CALLBACK_URL?.trim() || undefined;

  return {
    async sendSms(input: TwilioSmsSendInput) {
      const from = input.from ?? fromNumber;

      const message = await client.messages.create({
        from,
        to: input.to,
        body: input.body,
        ...(statusCallback ? { statusCallback } : {}),
      });

      return { sid: message.sid };
    },
  };
}
