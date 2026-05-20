import type { MessageDeliveryStatus } from "@/integrations/supabase/database.types";

/**
 * Twilio Message resource status values on status callbacks (`MessageStatus`).
 * @see https://www.twilio.com/docs/messaging/api/message-resource#message-status-values
 */
export type TwilioMessageResourceStatus = string;

export type TwilioStatusCallbackPayload = {
  messageSid: string;
  messageStatus: TwilioMessageResourceStatus;
  errorCode: string | null;
};

/**
 * Parses Twilio `application/x-www-form-urlencoded` fields for a **status callback** (not inbound SMS).
 */
export function parseTwilioStatusCallbackPayload(
  raw: Record<string, string>
): TwilioStatusCallbackPayload | null {
  const messageSid = raw.MessageSid?.trim();
  const messageStatus = raw.MessageStatus?.trim();
  if (!messageSid || !messageStatus) {
    return null;
  }
  const errorCode = raw.ErrorCode?.trim() || null;
  return { messageSid, messageStatus, errorCode };
}

/**
 * Maps Twilio `MessageStatus` to our `messages.delivery_status` enum.
 * Unknown Twilio values return `null` (metadata still records raw status).
 */
export function mapTwilioMessageStatusToDelivery(
  twilioStatus: string
): MessageDeliveryStatus | null {
  switch (twilioStatus) {
    case "queued":
    case "accepted":
      return "queued";
    case "scheduled":
    case "sending":
      return "pending";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "undelivered":
    case "failed":
    case "canceled":
      return "failed";
    default:
      return null;
  }
}
