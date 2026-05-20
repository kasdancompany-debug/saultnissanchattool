import { validateTwilioWebhookRequest } from "@/integrations/twilio/webhook-signature";
import { getTwilioWebhookPublicUrl } from "@/server/webhooks/twilio/public-request-url";

export { getTwilioWebhookPublicUrl };

export function validateTwilioWebhookSignature(
  authToken: string,
  signature: string | null,
  request: Request,
  bodyParams: Record<string, string>
): boolean {
  const fullUrl = getTwilioWebhookPublicUrl(request);
  return validateTwilioWebhookRequest(authToken, signature, fullUrl, bodyParams);
}
