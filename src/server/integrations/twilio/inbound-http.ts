/**
 * Re-exports for legacy `sms` route. Prefer `./inbound-sms-webhook`.
 */
export {
  handleTwilioInboundSmsPost,
  POST,
  runtime,
  maxDuration,
} from "./inbound-sms-webhook";
