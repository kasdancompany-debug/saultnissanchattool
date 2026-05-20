/**
 * Parsed Twilio SMS webhook fields we rely on (subset of full payload).
 * @see https://www.twilio.com/docs/messaging/webhooks/incoming-webhooks
 */
export type TwilioInboundSmsFields = {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  /** ISO or RFC2822 depending on field — stored raw in raw_payload */
  DateSent?: string;
};

export function formDataToTwilioRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") {
      out[key] = value;
    }
  });
  return out;
}

export function parseInboundSmsFields(
  raw: Record<string, string>
): TwilioInboundSmsFields | null {
  const MessageSid = raw.MessageSid?.trim();
  const From = raw.From?.trim();
  const To = raw.To?.trim();
  const Body = raw.Body ?? "";
  if (!MessageSid || !From || !To) {
    return null;
  }
  return {
    MessageSid,
    AccountSid: raw.AccountSid ?? "",
    From,
    To,
    Body,
    NumMedia: raw.NumMedia,
    DateSent: raw.DateSent,
  };
}
