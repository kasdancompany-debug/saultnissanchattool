-- =============================================================================
-- Dealership chat platform — production schema (GREENFIELD)
-- =============================================================================
-- Run once on a new Supabase project (empty public schema) or a fresh database.
-- If you already use the versioned files under supabase/migrations/, do NOT run this;
-- those migrations are the source of truth for incremental upgrades.
--
-- Includes: enums, core tables, indexes, updated_at + last_message_at triggers,
-- Twilio columns, RLS, SECURITY DEFINER helpers, multi-tenant policies.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
CREATE TYPE public.conversation_channel AS ENUM (
  'sms',
  'web_chat',
  'email',
  'facebook',
  'other'
);

CREATE TYPE public.staff_department AS ENUM (
  'sales',
  'service',
  'parts',
  'bdc',
  'management',
  'general'
);

CREATE TYPE public.conversation_status AS ENUM (
  'open',
  'pending',
  'waiting_for_human',
  'resolved',
  'closed',
  'archived',
  'spam'
);

CREATE TYPE public.conversation_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

CREATE TYPE public.sentiment AS ENUM (
  'unknown',
  'positive',
  'neutral',
  'negative'
);

CREATE TYPE public.message_sender_type AS ENUM (
  'customer',
  'staff',
  'system',
  'ai'
);

CREATE TYPE public.message_delivery_status AS ENUM (
  'pending',
  'queued',
  'sent',
  'delivered',
  'failed',
  'read'
);

CREATE TYPE public.conversation_event_type AS ENUM (
  'conversation_created',
  'conversation_updated',
  'status_changed',
  'priority_changed',
  'department_changed',
  'channel_changed',
  'sentiment_updated',
  'ai_toggled',
  'assignment_created',
  'assignment_removed',
  'message_inbound',
  'message_outbound',
  'staff_reply',
  'customer_linked',
  'integration_error',
  'routing_rule_applied',
  'metadata_changed'
);

CREATE TYPE public.staff_role AS ENUM (
  'admin',
  'manager',
  'advisor',
  'bdc',
  'readonly'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.dealerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL,
  slug text UNIQUE,
  timezone text NOT NULL DEFAULT 'America/Toronto',
  twilio_phone_e164 text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dealerships_slug_format CHECK (
    slug IS NULL
    OR slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

CREATE UNIQUE INDEX dealerships_twilio_phone_e164_uidx ON public.dealerships (twilio_phone_e164)
WHERE
  twilio_phone_e164 IS NOT NULL;

COMMENT ON COLUMN public.dealerships.twilio_phone_e164 IS
  'E.164 number provisioned for this dealership (inbound To / outbound From).';

CREATE TABLE public.staff_users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  dealership_id uuid NOT NULL REFERENCES public.dealerships (id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  role public.staff_role NOT NULL DEFAULT 'advisor',
  department public.staff_department NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_users_email_lower CHECK (email = lower(email))
);

CREATE UNIQUE INDEX staff_users_dealership_email_uidx ON public.staff_users (dealership_id, email);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  dealership_id uuid NOT NULL REFERENCES public.dealerships (id) ON DELETE CASCADE,
  display_name text,
  email text,
  phone_e164 text,
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_email_lower CHECK (
    email IS NULL
    OR email = lower(email)
  ),
  CONSTRAINT customers_phone_e164 CHECK (
    phone_e164 IS NULL
    OR phone_e164 ~ '^\+[1-9][0-9]{6,14}$'
  )
);

CREATE UNIQUE INDEX customers_dealership_phone_uidx ON public.customers (dealership_id, phone_e164)
WHERE
  phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX customers_dealership_email_uidx ON public.customers (dealership_id, email)
WHERE
  email IS NOT NULL;

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  dealership_id uuid NOT NULL REFERENCES public.dealerships (id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  channel public.conversation_channel NOT NULL,
  department public.staff_department NOT NULL DEFAULT 'general',
  status public.conversation_status NOT NULL DEFAULT 'open',
  priority public.conversation_priority NOT NULL DEFAULT 'normal',
  sentiment public.sentiment NOT NULL DEFAULT 'unknown',
  ai_enabled boolean NOT NULL DEFAULT false,
  assigned_to_user_id uuid REFERENCES public.staff_users (id) ON DELETE SET NULL,
  last_message_at timestamptz,
  title text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_type public.message_sender_type NOT NULL,
  sender_user_id uuid REFERENCES public.staff_users (id) ON DELETE SET NULL,
  body text NOT NULL DEFAULT '',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_status public.message_delivery_status NOT NULL DEFAULT 'pending',
  twilio_inbound_sid text,
  twilio_outbound_sid text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_sender_consistency CHECK (
    (
      sender_type = 'customer'
      AND sender_user_id IS NULL
    )
    OR (
      sender_type = 'staff'
      AND sender_user_id IS NOT NULL
    )
    OR (sender_type IN ('system', 'ai'))
  )
);

CREATE UNIQUE INDEX messages_twilio_inbound_sid_uidx ON public.messages (twilio_inbound_sid)
WHERE
  twilio_inbound_sid IS NOT NULL;

CREATE UNIQUE INDEX messages_twilio_outbound_sid_uidx ON public.messages (twilio_outbound_sid)
WHERE
  twilio_outbound_sid IS NOT NULL;

CREATE TABLE public.conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  event_type public.conversation_event_type NOT NULL,
  actor_user_id uuid REFERENCES public.staff_users (id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.conversation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  assigned_to_user_id uuid NOT NULL REFERENCES public.staff_users (id) ON DELETE RESTRICT,
  assigned_by_user_id uuid REFERENCES public.staff_users (id) ON DELETE SET NULL,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes — inbox lists, queues, timelines, provider idempotency
-- ---------------------------------------------------------------------------
CREATE INDEX staff_users_dealership_active_idx ON public.staff_users (dealership_id)
WHERE
  is_active = true;

CREATE INDEX conversations_dealership_last_message_idx ON public.conversations (
  dealership_id,
  last_message_at DESC NULLS LAST
);

CREATE INDEX conversations_dealership_status_last_msg_idx ON public.conversations (
  dealership_id,
  status,
  last_message_at DESC NULLS LAST
);

CREATE INDEX conversations_dealership_dept_status_last_msg_idx ON public.conversations (
  dealership_id,
  department,
  status,
  last_message_at DESC NULLS LAST
);

CREATE INDEX conversations_dealership_assignee_last_msg_idx ON public.conversations (
  dealership_id,
  assigned_to_user_id,
  last_message_at DESC NULLS LAST
)
WHERE
  assigned_to_user_id IS NOT NULL;

CREATE INDEX conversations_dealership_priority_last_msg_idx ON public.conversations (
  dealership_id,
  priority,
  last_message_at DESC NULLS LAST
);

CREATE INDEX conversations_customer_created_idx ON public.conversations (customer_id, created_at DESC)
WHERE
  customer_id IS NOT NULL;

CREATE INDEX conversations_dealership_inbox_unassigned_idx ON public.conversations (
  dealership_id,
  department,
  status,
  last_message_at DESC NULLS LAST
)
WHERE
  assigned_to_user_id IS NULL
  AND status IN (
    'open',
    'pending',
    'waiting_for_human');

CREATE INDEX conversations_dealership_assigned_active_idx ON public.conversations (
  dealership_id,
  assigned_to_user_id,
  status,
  last_message_at DESC NULLS LAST
)
WHERE
  assigned_to_user_id IS NOT NULL
  AND status IN (
    'open',
    'pending',
    'waiting_for_human');

CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at ASC);

CREATE INDEX messages_delivery_status_idx ON public.messages (delivery_status)
WHERE
  delivery_status IN ('pending', 'queued', 'failed');

CREATE INDEX messages_sender_user_id_idx ON public.messages (sender_user_id)
WHERE
  sender_user_id IS NOT NULL;

CREATE INDEX conversation_events_conversation_created_idx ON public.conversation_events (
  conversation_id,
  created_at ASC
);

CREATE INDEX conversation_events_type_idx ON public.conversation_events (event_type, created_at DESC);

CREATE INDEX conversation_assignments_conversation_created_idx ON public.conversation_assignments (
  conversation_id,
  created_at DESC
);

CREATE INDEX conversation_assignments_assignee_idx ON public.conversation_assignments (assigned_to_user_id, created_at DESC);

CREATE INDEX customers_dealership_created_idx ON public.customers (
  dealership_id,
  created_at DESC);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at + denormalized last_message_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at () RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER dealerships_set_updated_at BEFORE UPDATE ON public.dealerships FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER staff_users_set_updated_at BEFORE UPDATE ON public.staff_users FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER conversations_set_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER messages_set_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE OR REPLACE FUNCTION public.messages_bump_conversation_last_message_at ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $$
BEGIN
  UPDATE
    public.conversations
  SET
    last_message_at = NEW.created_at
  WHERE
    id = NEW.conversation_id
    AND (last_message_at IS NULL
      OR last_message_at < NEW.created_at);
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_bump_conversation_last_message_at
  AFTER INSERT ON public.messages FOR EACH ROW
  EXECUTE FUNCTION public.messages_bump_conversation_last_message_at ();

-- ---------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER — avoid recursion on staff_users)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_dealership_access (p_dealership_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    EXISTS (
      SELECT
        1
      FROM
        public.staff_users s
      WHERE
        s.id = auth.uid()
        AND s.dealership_id = p_dealership_id
        AND s.is_active = TRUE);
$$;

CREATE OR REPLACE FUNCTION public.user_has_dealership_write_access (p_dealership_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    EXISTS (
      SELECT
        1
      FROM
        public.staff_users s
      WHERE
        s.id = auth.uid()
        AND s.dealership_id = p_dealership_id
        AND s.is_active = TRUE
        AND s.role <> 'readonly'::public.staff_role);
$$;

CREATE OR REPLACE FUNCTION public.current_staff_is_privileged ()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    EXISTS (
      SELECT
        1
      FROM
        public.staff_users s
      WHERE
        s.id = auth.uid()
        AND s.is_active = TRUE
        AND s.role IN ('admin', 'manager'));
$$;

GRANT EXECUTE ON FUNCTION public.user_has_dealership_access (uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.user_has_dealership_write_access (uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_staff_is_privileged () TO authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.dealerships ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;

-- dealerships
CREATE POLICY dealerships_select ON public.dealerships FOR SELECT TO authenticated
  USING (user_has_dealership_access (id));

CREATE POLICY dealerships_update ON public.dealerships FOR UPDATE TO authenticated
  USING (user_has_dealership_access (id)
    AND current_staff_is_privileged ())
  WITH CHECK (user_has_dealership_access (id)
    AND current_staff_is_privileged ());

-- staff_users: directory read; profile update self or privileged (no INSERT/DELETE via JWT)
CREATE POLICY staff_users_select ON public.staff_users FOR SELECT TO authenticated
  USING (user_has_dealership_access (dealership_id));

CREATE POLICY staff_users_update ON public.staff_users FOR UPDATE TO authenticated
  USING (user_has_dealership_access (dealership_id)
    AND (id = auth.uid ()
      OR current_staff_is_privileged ()))
  WITH CHECK (user_has_dealership_access (dealership_id)
    AND (id = auth.uid ()
      OR current_staff_is_privileged ()));

-- customers
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated
  USING (user_has_dealership_access (dealership_id));

CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated
  WITH CHECK (user_has_dealership_write_access (dealership_id));

CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated
  USING (user_has_dealership_access (dealership_id))
  WITH CHECK (user_has_dealership_write_access (dealership_id));

CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated
  USING (user_has_dealership_access (dealership_id)
    AND current_staff_is_privileged ());

-- conversations
CREATE POLICY conversations_select ON public.conversations FOR SELECT TO authenticated
  USING (user_has_dealership_access (dealership_id));

CREATE POLICY conversations_insert ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (user_has_dealership_write_access (dealership_id));

CREATE POLICY conversations_update ON public.conversations FOR UPDATE TO authenticated
  USING (user_has_dealership_access (dealership_id))
  WITH CHECK (user_has_dealership_write_access (dealership_id));

CREATE POLICY conversations_delete ON public.conversations FOR DELETE TO authenticated
  USING (user_has_dealership_access (dealership_id)
    AND current_staff_is_privileged ());

-- messages (tenant via parent conversation)
CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = messages.conversation_id
      AND user_has_dealership_access (c.dealership_id)));

CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = messages.conversation_id
      AND user_has_dealership_write_access (c.dealership_id)));

CREATE POLICY messages_update ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = messages.conversation_id
      AND user_has_dealership_access (c.dealership_id)))
  WITH CHECK (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = messages.conversation_id
      AND user_has_dealership_write_access (c.dealership_id)));

CREATE POLICY messages_delete ON public.messages FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = messages.conversation_id
      AND user_has_dealership_access (c.dealership_id)
      AND current_staff_is_privileged ()));

-- conversation_events (append-only: no UPDATE policy)
CREATE POLICY conversation_events_select ON public.conversation_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = conversation_events.conversation_id
      AND user_has_dealership_access (c.dealership_id)));

CREATE POLICY conversation_events_insert ON public.conversation_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = conversation_events.conversation_id
      AND user_has_dealership_write_access (c.dealership_id)));

-- conversation_assignments
CREATE POLICY conversation_assignments_select ON public.conversation_assignments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = conversation_assignments.conversation_id
      AND user_has_dealership_access (c.dealership_id)));

CREATE POLICY conversation_assignments_insert ON public.conversation_assignments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = conversation_assignments.conversation_id
      AND user_has_dealership_write_access (c.dealership_id)));

CREATE POLICY conversation_assignments_update ON public.conversation_assignments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = conversation_assignments.conversation_id
      AND user_has_dealership_access (c.dealership_id)))
  WITH CHECK (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = conversation_assignments.conversation_id
      AND user_has_dealership_write_access (c.dealership_id)));

CREATE POLICY conversation_assignments_delete ON public.conversation_assignments FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT
      1
    FROM
      public.conversations c
    WHERE
      c.id = conversation_assignments.conversation_id
      AND user_has_dealership_access (c.dealership_id)
      AND current_staff_is_privileged ()));

-- ---------------------------------------------------------------------------
-- Table / column comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.dealerships IS 'Tenant root; all operational data is scoped by dealership_id.';

COMMENT ON TABLE public.staff_users IS 'Staff profiles; id matches auth.users. One dealership_id today; use memberships table when staff can span stores.';

COMMENT ON TABLE public.customers IS 'End customers; optional identity fields until verified.';

COMMENT ON TABLE public.conversations IS 'Omnichannel threads; last_message_at denormalized for inbox sorting.';

COMMENT ON TABLE public.messages IS 'Messages; sender rules enforced via CHECK; raw_payload for provider JSON.';

COMMENT ON TABLE public.conversation_events IS 'Append-only audit trail for automation, compliance, and UI history.';

COMMENT ON TABLE public.conversation_assignments IS 'Assignment history; current owner also on conversations.assigned_to_user_id.';

COMMENT ON COLUMN public.conversations.last_message_at IS 'Denormalized; maintained by trigger on message insert.';

COMMENT ON COLUMN public.messages.raw_payload IS 'Provider payloads; validate at ingest.';

COMMENT ON COLUMN public.messages.twilio_inbound_sid IS 'Twilio MessageSid for inbound SMS (idempotency).';

COMMENT ON COLUMN public.messages.twilio_outbound_sid IS 'Twilio MessageSid for outbound SMS (status callbacks).';

COMMENT ON FUNCTION public.user_has_dealership_access (uuid) IS 'True when JWT user is active staff for the dealership.';

COMMENT ON FUNCTION public.user_has_dealership_write_access (uuid) IS 'Active staff and not readonly; required for mutating ops data.';

COMMENT ON FUNCTION public.current_staff_is_privileged () IS 'Admin or manager in at least one dealership (extend for multi-store).';
