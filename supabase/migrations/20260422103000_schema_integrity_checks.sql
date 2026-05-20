-- Post-migration verification hardening: CHECK constraints + documentation comments.
-- Does not alter architecture, FK targets, or replace existing indexes.
--
-- Apply after all prior migrations (including 20260421140000_core_tables_production_hardening).
-- If any CHECK fails, fix offending rows, then re-run.

-- ---------------------------------------------------------------------------
-- Timestamp consistency (tables with created_at + updated_at)
-- ---------------------------------------------------------------------------
ALTER TABLE public.dealerships
  ADD CONSTRAINT dealerships_timestamps_consistent CHECK (updated_at >= created_at);

ALTER TABLE public.staff_users
  ADD CONSTRAINT staff_users_timestamps_consistent CHECK (updated_at >= created_at);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_timestamps_consistent CHECK (updated_at >= created_at);

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_timestamps_consistent CHECK (updated_at >= created_at);

ALTER TABLE public.messages
  ADD CONSTRAINT messages_timestamps_consistent CHECK (updated_at >= created_at);

-- ---------------------------------------------------------------------------
-- Required-looking text fields: reject whitespace-only values where NOT NULL is required
-- ---------------------------------------------------------------------------
ALTER TABLE public.dealerships
  ADD CONSTRAINT dealerships_name_nonempty CHECK (length(trim(name)) > 0);

ALTER TABLE public.staff_users
  ADD CONSTRAINT staff_users_display_name_nonempty CHECK (length(trim(display_name)) > 0);

-- Reasonable upper bound for email storage (RFC-inspired; avoids accidental huge strings)
ALTER TABLE public.staff_users
  ADD CONSTRAINT staff_users_email_length CHECK (char_length(email) <= 320);

-- ---------------------------------------------------------------------------
-- Message body: cap size to mitigate abuse / accidental huge payloads (text is unbounded in PG)
-- ---------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD CONSTRAINT messages_body_max_size CHECK (char_length(body) <= 1048576);

-- ---------------------------------------------------------------------------
-- Column documentation (nullable vs required semantics for operators)
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.customers.display_name IS
  'Nullable for unidentified widget/SMS leads until CRM links a profile.';

COMMENT ON COLUMN public.customers.email IS
  'Nullable; lower-case enforced by CHECK when present.';

COMMENT ON COLUMN public.customers.phone_e164 IS
  'Nullable; E.164 enforced by CHECK when present.';

COMMENT ON COLUMN public.conversations.customer_id IS
  'Nullable until a customer row is linked to the thread.';

COMMENT ON COLUMN public.conversations.last_message_at IS
  'Denormalized sort key; updated by application and by messages_bump_conversation_last_message_at trigger.';

COMMENT ON COLUMN public.conversations.title IS
  'Optional human-readable label; many SMS threads have no title.';

COMMENT ON COLUMN public.conversations.assigned_to_user_id IS
  'Nullable for unassigned queue; mirrors latest assignment intent.';

COMMENT ON COLUMN public.messages.sender_user_id IS
  'Required for sender_type=staff; must be null for customer per messages_sender_consistency.';

COMMENT ON COLUMN public.messages.body IS
  'May be empty for non-text system events; size capped by messages_body_max_size.';

COMMENT ON COLUMN public.conversation_events.actor_user_id IS
  'Nullable for automated/system-emitted events without a staff actor.';

COMMENT ON COLUMN public.conversation_assignments.note IS
  'Optional assignment context; history rows remain even when conversation is reassigned.';
