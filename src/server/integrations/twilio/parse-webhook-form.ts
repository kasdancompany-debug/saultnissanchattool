import { formDataToTwilioRecord } from "@/integrations/twilio/inbound-form";

/** Twilio webhooks POST `application/x-www-form-urlencoded` as `FormData` in the App Router. */
export function parseTwilioWebhookFormBody(form: FormData): Record<string, string> {
  return formDataToTwilioRecord(form);
}
