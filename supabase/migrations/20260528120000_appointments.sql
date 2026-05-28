-- Conversation-linked appointments (sales / service). Pipeline metadata stamps remain
-- the source of truth for War room "Appointment booked" until staff confirms here or via Pipeline.

CREATE TYPE public.appointment_department AS ENUM ('sales', 'service');

CREATE TYPE public.appointment_status AS ENUM (
  'proposed',
  'awaiting_confirmation',
  'confirmed',
  'completed',
  'no_show',
  'cancelled'
);

CREATE TYPE public.appointment_source AS ENUM (
  'ai_detected',
  'manual',
  'quick_action'
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  dealership_id uuid NOT NULL REFERENCES public.dealerships (id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  department public.appointment_department NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'proposed',
  proposed_datetime timestamptz,
  confirmed_datetime timestamptz,
  assigned_user_id uuid REFERENCES public.staff_users (id) ON DELETE SET NULL,
  booked_by_user_id uuid REFERENCES public.staff_users (id) ON DELETE SET NULL,
  vehicle_interest text,
  notes text,
  source public.appointment_source NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_timestamps_consistent CHECK (updated_at >= created_at),
  CONSTRAINT appointments_confirmed_has_datetime CHECK (
    status NOT IN ('confirmed', 'completed')
    OR confirmed_datetime IS NOT NULL
  ),
  CONSTRAINT appointments_vehicle_interest_len CHECK (
    vehicle_interest IS NULL
    OR char_length(trim(vehicle_interest)) >= 1
  )
);

CREATE INDEX appointments_dealership_conversation_idx ON public.appointments (dealership_id, conversation_id, created_at DESC);

CREATE INDEX appointments_dealership_status_confirmed_idx ON public.appointments (dealership_id, status, confirmed_datetime DESC NULLS LAST)
WHERE
  status IN ('confirmed', 'completed');

CREATE INDEX appointments_conversation_active_idx ON public.appointments (conversation_id, created_at DESC)
WHERE
  status NOT IN ('cancelled');

-- Keep dealership_id aligned with the parent conversation; default customer_id from conversation.
CREATE OR REPLACE FUNCTION public.appointments_sync_from_conversation ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_dealership_id uuid;
  v_customer_id uuid;
BEGIN
  SELECT
    c.dealership_id,
    c.customer_id INTO v_dealership_id,
    v_customer_id
  FROM
    public.conversations c
  WHERE
    c.id = NEW.conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CONVERSATION'
      USING ERRCODE = 'P0001';
  END IF;

  NEW.dealership_id := v_dealership_id;

  IF NEW.customer_id IS NOT NULL AND NOT EXISTS (
    SELECT
      1
    FROM
      public.customers cu
    WHERE
      cu.id = NEW.customer_id
      AND cu.dealership_id = v_dealership_id) THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.customer_id IS NULL THEN
    NEW.customer_id := v_customer_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_sync_from_conversation_trg
  BEFORE INSERT OR UPDATE OF conversation_id,
  customer_id ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.appointments_sync_from_conversation ();

CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at ();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY appointments_select ON public.appointments
  FOR SELECT TO authenticated
    USING (user_has_dealership_access (dealership_id));

CREATE POLICY appointments_insert ON public.appointments
  FOR INSERT TO authenticated
    WITH CHECK (user_has_dealership_write_access (dealership_id));

CREATE POLICY appointments_update ON public.appointments
  FOR UPDATE TO authenticated
    USING (user_has_dealership_write_access (dealership_id))
    WITH CHECK (user_has_dealership_write_access (dealership_id));

CREATE POLICY appointments_delete ON public.appointments
  FOR DELETE TO authenticated
    USING (
      user_has_dealership_write_access (dealership_id)
      AND current_staff_is_privileged ()
    );

COMMENT ON TABLE public.appointments IS 'Visit appointments linked to inbox conversations. War room pipeline.appointment is set separately when staff confirms (see app sync on confirm).';
