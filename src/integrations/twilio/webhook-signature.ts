import twilio from "twilio";

/**
 * Validates an incoming Twilio webhook request (POST, application/x-www-form-urlencoded).
 * @param fullUrl Exact public URL Twilio called (must match Twilio console webhook URL).
 */
export function validateTwilioWebhookRequest(
  authToken: string,
  twilioSignature: string | null,
  fullUrl: string,
  bodyParams: Record<string, string>
): boolean {
  if (!twilioSignature) {
    return false;
  }
  return twilio.validateRequest(authToken, twilioSignature, fullUrl, bodyParams);
}
