# Twilio SMS (routing into inbox)

Documentation for Twilio Console setup, env vars, and flows now lives in:

**`src/server/integrations/twilio/README.md`**

Staff SMS: `sendStaffReply` → `conversation-sms-outbound.service.ts` → `sendTwilioOutboundSms`.  
Transport-only path: `outbound-sms-transport.ts` → `sendTwilioOutboundSms` (message row must already exist).
