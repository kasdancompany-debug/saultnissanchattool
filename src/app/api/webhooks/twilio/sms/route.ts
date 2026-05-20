/**
 * Legacy Twilio inbound URL. Prefer `POST /api/webhooks/twilio/inbound` for new console configuration.
 */
export {
  handleTwilioInboundSmsPost as POST,
  runtime,
  maxDuration,
} from "@/server/integrations/twilio/inbound-http";
