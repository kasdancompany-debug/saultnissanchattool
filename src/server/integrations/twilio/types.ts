/**
 * Provider-agnostic inbound SMS shape after Twilio webhook normalization.
 * Meta and other channels can introduce parallel types that map into the same persistence path.
 */
export type NormalizedInboundSms = {
  externalMessageId: string;
  channel: "sms";
  customerPhone: string;
  text: string;
  timestamp: string;
  /** Full Twilio POST body (form fields) for audit and debugging. */
  rawPayload: Record<string, string>;
};
