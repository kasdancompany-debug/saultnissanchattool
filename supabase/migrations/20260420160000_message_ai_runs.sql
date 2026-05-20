-- AI assist runs for inbound customer messages (audit + inbox UI).

CREATE TABLE public.message_ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  dealership_id uuid NOT NULL REFERENCES public.dealerships (id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages (id) ON DELETE CASCADE,
  prompt_version text NOT NULL,
  model text NOT NULL,
  structured_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  latency_ms integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX message_ai_runs_conversation_created_idx ON public.message_ai_runs (
  conversation_id,
  created_at DESC
);

CREATE INDEX message_ai_runs_message_idx ON public.message_ai_runs (message_id);

CREATE INDEX message_ai_runs_dealership_created_idx ON public.message_ai_runs (
  dealership_id,
  created_at DESC
);

COMMENT ON TABLE public.message_ai_runs IS
  'Structured AI classification + safe draft per inbound customer message; inserts use service role only.';

ALTER TABLE public.message_ai_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_ai_runs_select ON public.message_ai_runs FOR
SELECT
  TO authenticated USING (user_has_dealership_access (dealership_id));
