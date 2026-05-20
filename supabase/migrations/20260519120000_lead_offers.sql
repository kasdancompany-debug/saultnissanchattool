-- Lead Offers Engine: dealership-configurable promotions + funnel analytics.

CREATE TYPE public.lead_offer_event_type AS ENUM (
  'view',
  'start',
  'complete',
  'lead'
);

CREATE TABLE public.lead_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  dealership_id uuid NOT NULL REFERENCES public.dealerships (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT TRUE,
  department public.staff_department NOT NULL DEFAULT 'general',
  priority integer NOT NULL DEFAULT 50,
  starts_at timestamptz,
  ends_at timestamptz,
  cta_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_offers_name_len CHECK (char_length(trim(name)) >= 1),
  CONSTRAINT lead_offers_priority_range CHECK (priority >= 0 AND priority <= 1000),
  CONSTRAINT lead_offers_date_order CHECK (
    starts_at IS NULL
    OR ends_at IS NULL
    OR ends_at >= starts_at
  )
);

CREATE INDEX lead_offers_dealership_active_idx ON public.lead_offers (dealership_id, is_active, priority DESC);

CREATE INDEX lead_offers_dealership_department_idx ON public.lead_offers (dealership_id, department);

CREATE TABLE public.lead_offer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  dealership_id uuid NOT NULL REFERENCES public.dealerships (id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.lead_offers (id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations (id) ON DELETE SET NULL,
  event_type public.lead_offer_event_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_offer_events_dealership_created_idx ON public.lead_offer_events (dealership_id, created_at DESC);

CREATE INDEX lead_offer_events_offer_type_idx ON public.lead_offer_events (offer_id, event_type, created_at DESC);

CREATE UNIQUE INDEX lead_offer_events_dedupe_idx ON public.lead_offer_events (
  offer_id,
  conversation_id,
  event_type
)
WHERE
  conversation_id IS NOT NULL;

ALTER TABLE public.lead_offers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lead_offer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_offers_select ON public.lead_offers
  FOR SELECT TO authenticated
    USING (user_has_dealership_access (dealership_id));

CREATE POLICY lead_offers_insert ON public.lead_offers
  FOR INSERT TO authenticated
    WITH CHECK (user_has_dealership_write_access (dealership_id));

CREATE POLICY lead_offers_update ON public.lead_offers
  FOR UPDATE TO authenticated
    USING (user_has_dealership_write_access (dealership_id))
    WITH CHECK (user_has_dealership_write_access (dealership_id));

CREATE POLICY lead_offers_delete ON public.lead_offers
  FOR DELETE TO authenticated
    USING (
      user_has_dealership_write_access (dealership_id)
      AND current_staff_is_privileged ()
    );

CREATE POLICY lead_offer_events_select ON public.lead_offer_events
  FOR SELECT TO authenticated
    USING (user_has_dealership_access (dealership_id));

COMMENT ON TABLE public.lead_offers IS 'Dealership lead-generation offers surfaced by AI and tracked in analytics.';

COMMENT ON TABLE public.lead_offer_events IS 'Funnel events: view (AI mention), start (customer engaged), complete (intake finished), lead (CRM lead created).';
