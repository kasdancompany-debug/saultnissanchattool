-- Idempotent processing for telephony webhooks (missed-call, future triggers).

CREATE TABLE public.telephony_event_dedupe (
  dedupe_key text PRIMARY KEY,
  dealership_id uuid NOT NULL REFERENCES public.dealerships (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'missed_call',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX telephony_event_dedupe_dealership_created_idx ON public.telephony_event_dedupe (
  dealership_id,
  created_at DESC
);

COMMENT ON TABLE public.telephony_event_dedupe IS
  'Prevents duplicate side-effects when upstream providers retry webhooks (e.g. same external call id).';

ALTER TABLE public.telephony_event_dedupe ENABLE ROW LEVEL SECURITY;
