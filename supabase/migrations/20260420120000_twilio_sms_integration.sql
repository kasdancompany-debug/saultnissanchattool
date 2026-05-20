-- Twilio SMS: idempotency + routing + status callback lookup

ALTER TABLE public.dealerships
ADD COLUMN IF NOT EXISTS twilio_phone_e164 text;

COMMENT ON COLUMN public.dealerships.twilio_phone_e164 IS
  'E.164 number provisioned for this dealership (inbound To / outbound From). Must match Twilio console.';

CREATE UNIQUE INDEX IF NOT EXISTS dealerships_twilio_phone_e164_uidx
ON public.dealerships (twilio_phone_e164)
WHERE
  twilio_phone_e164 IS NOT NULL;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS twilio_inbound_sid text;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS twilio_outbound_sid text;

COMMENT ON COLUMN public.messages.twilio_inbound_sid IS
  'Twilio MessageSid for inbound SMS — unique for idempotent webhook processing.';

COMMENT ON COLUMN public.messages.twilio_outbound_sid IS
  'Twilio MessageSid for outbound staff SMS — used for status callbacks.';

CREATE UNIQUE INDEX IF NOT EXISTS messages_twilio_inbound_sid_uidx
ON public.messages (twilio_inbound_sid)
WHERE
  twilio_inbound_sid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS messages_twilio_outbound_sid_uidx
ON public.messages (twilio_outbound_sid)
WHERE
  twilio_outbound_sid IS NOT NULL;
