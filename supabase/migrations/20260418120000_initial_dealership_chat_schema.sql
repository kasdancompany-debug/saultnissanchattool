-- Initial schema: dealership omnichannel communications
-- PostgreSQL / Supabase — run via `supabase db push` or `supabase migration up`
--
-- Conventions:
-- - All timestamps: timestamptz (UTC), named created_at / updated_at
-- - Primary keys: gen_random_uuid()
-- - Soft operational deletes: prefer status/archival on conversations; hard deletes cascades where noted

-- ---------------------------------------------------------------------------
-- Extensions (Supabase typically has these; statements are idempotent where possible)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerated types (explicit, checkable, compact storage)
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
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dealerships_slug_format CHECK (
    slug IS NULL
    OR slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

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
    OR (
      sender_type IN ('system', 'ai')
    )
  )
);

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
-- Indexes — see project docs / PR description for rationale
-- ---------------------------------------------------------------------------

-- Dealership-scoped staff directory lookups
CREATE INDEX staff_users_dealership_active_idx ON public.staff_users (dealership_id)
WHERE
  is_active = true;

-- Conversation list: default “newest activity first” per dealership
CREATE INDEX conversations_dealership_last_message_idx ON public.conversations (
  dealership_id,
  last_message_at DESC NULLS LAST
);

-- Filter by status (queues) then recency
CREATE INDEX conversations_dealership_status_last_msg_idx ON public.conversations (
  dealership_id,
  status,
  last_message_at DESC NULLS LAST
);

-- Filter by department + status (team inboxes)
CREATE INDEX conversations_dealership_dept_status_last_msg_idx ON public.conversations (
  dealership_id,
  department,
  status,
  last_message_at DESC NULLS LAST
);

-- Filter by assignee (my work / round-robin views)
CREATE INDEX conversations_dealership_assignee_last_msg_idx ON public.conversations (
  dealership_id,
  assigned_to_user_id,
  last_message_at DESC NULLS LAST
)
WHERE
  assigned_to_user_id IS NOT NULL;

-- Priority triage within a dealership
CREATE INDEX conversations_dealership_priority_last_msg_idx ON public.conversations (
  dealership_id,
  priority,
  last_message_at DESC NULLS LAST
);

-- Customer timeline lookup
CREATE INDEX conversations_customer_created_idx ON public.conversations (customer_id, created_at DESC)
WHERE
  customer_id IS NOT NULL;

-- Message timeline (clustered read pattern per thread)
CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at ASC);

CREATE INDEX messages_delivery_status_idx ON public.messages (delivery_status)
WHERE
  delivery_status IN ('pending', 'queued', 'failed');

-- Audit trail per conversation (append-only)
CREATE INDEX conversation_events_conversation_created_idx ON public.conversation_events (
  conversation_id,
  created_at ASC
);

CREATE INDEX conversation_events_type_idx ON public.conversation_events (event_type, created_at DESC);

-- Assignment history
CREATE INDEX conversation_assignments_conversation_created_idx ON public.conversation_assignments (
  conversation_id,
  created_at DESC
);

CREATE INDEX conversation_assignments_assignee_idx ON public.conversation_assignments (assigned_to_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at trigger (shared)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at () RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER dealerships_set_updated_at BEFORE
UPDATE ON public.dealerships FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER staff_users_set_updated_at BEFORE
UPDATE ON public.staff_users FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER customers_set_updated_at BEFORE
UPDATE ON public.customers FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER conversations_set_updated_at BEFORE
UPDATE ON public.conversations FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER messages_set_updated_at BEFORE
UPDATE ON public.messages FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- Comments (internal documentation)
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.dealerships IS 'Tenant root; all operational data is scoped by dealership_id.';

COMMENT ON TABLE public.staff_users IS 'Profiles for authenticated staff; id matches auth.users.';

COMMENT ON TABLE public.customers IS 'End customers; may be anonymous until identified.';

COMMENT ON TABLE public.conversations IS 'Omnichannel threads; denormalized last_message_at for fast sorting.';

COMMENT ON TABLE public.messages IS 'Immutable-by-default messages; raw_payload stores provider payloads.';

COMMENT ON TABLE public.conversation_events IS 'Append-only audit log for automation, compliance, and debugging.';

COMMENT ON TABLE public.conversation_assignments IS 'Historical assignment records; current assignee also on conversations.assigned_to_user_id.';

COMMENT ON COLUMN public.conversations.last_message_at IS 'Denormalized; update when a message is inserted or for system pings.';

COMMENT ON COLUMN public.messages.raw_payload IS 'Twilio/OpenAI/provider raw JSON; never trust without validation at ingest.';

-- ---------------------------------------------------------------------------
-- RLS: enable in a follow-up migration with policies per role.
-- ---------------------------------------------------------------------------
