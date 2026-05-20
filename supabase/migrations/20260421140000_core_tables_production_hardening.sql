-- Production hardening for core omnichannel tables (dealerships, staff_users, customers,
-- conversations, messages, conversation_events, conversation_assignments).
--
-- Assumptions (multi-tenant / ops):
-- - Tenant isolation is by public.dealerships.id; every operational row carries dealership_id
--   (directly or via FK) so RLS can scope with user_has_dealership_access(dealership_id).
-- - One dealership today; staff_users.dealership_id is a single FK. Future multi-store:
--   introduce e.g. staff_memberships(staff_id, dealership_id, role) and evolve helpers +
--   policies — do not hardcode "one store" in app business logic.
-- - Read-only staff: SELECT all tenant data; INSERT/UPDATE operational rows require
--   user_has_dealership_write_access (active + role <> readonly). Profile self-service on
--   staff_users stays covered by existing staff_users_update policy.
-- - last_message_at is denormalized; this migration adds a trigger so it stays consistent
--   when rows are inserted into messages (app-level updates remain valid).
-- - Service role / Edge functions bypass RLS; keep webhooks and automation on service role.

-- ---------------------------------------------------------------------------
-- Write access: active staff who are not readonly (mutations from authenticated JWT)
-- ---------------------------------------------------------------------------
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

COMMENT ON FUNCTION public.user_has_dealership_write_access (uuid) IS
  'True when the current user may mutate operational rows for this dealership (not readonly).';

GRANT EXECUTE ON FUNCTION public.user_has_dealership_write_access (uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Tighten INSERT/UPDATE policies: readonly may SELECT but not mutate core ops data
-- (Deletes unchanged: still privileged-only where already enforced.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS customers_insert ON public.customers;

CREATE POLICY customers_insert ON public.customers
  FOR INSERT TO authenticated
    WITH CHECK (user_has_dealership_write_access (dealership_id));

DROP POLICY IF EXISTS customers_update ON public.customers;

CREATE POLICY customers_update ON public.customers
  FOR UPDATE TO authenticated
    USING (user_has_dealership_access (dealership_id))
    WITH CHECK (user_has_dealership_write_access (dealership_id));

DROP POLICY IF EXISTS conversations_insert ON public.conversations;

CREATE POLICY conversations_insert ON public.conversations
  FOR INSERT TO authenticated
    WITH CHECK (user_has_dealership_write_access (dealership_id));

DROP POLICY IF EXISTS conversations_update ON public.conversations;

CREATE POLICY conversations_update ON public.conversations
  FOR UPDATE TO authenticated
    USING (user_has_dealership_access (dealership_id))
    WITH CHECK (user_has_dealership_write_access (dealership_id));

DROP POLICY IF EXISTS messages_insert ON public.messages;

CREATE POLICY messages_insert ON public.messages
  FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT
        1
      FROM
        public.conversations c
      WHERE
        c.id = messages.conversation_id
        AND user_has_dealership_write_access (c.dealership_id)));

DROP POLICY IF EXISTS messages_update ON public.messages;

CREATE POLICY messages_update ON public.messages
  FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS conversation_events_insert ON public.conversation_events;

CREATE POLICY conversation_events_insert ON public.conversation_events
  FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT
        1
      FROM
        public.conversations c
      WHERE
        c.id = conversation_events.conversation_id
        AND user_has_dealership_write_access (c.dealership_id)));

DROP POLICY IF EXISTS conversation_assignments_insert ON public.conversation_assignments;

CREATE POLICY conversation_assignments_insert ON public.conversation_assignments
  FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT
        1
      FROM
        public.conversations c
      WHERE
        c.id = conversation_assignments.conversation_id
        AND user_has_dealership_write_access (c.dealership_id)));

DROP POLICY IF EXISTS conversation_assignments_update ON public.conversation_assignments;

CREATE POLICY conversation_assignments_update ON public.conversation_assignments
  FOR UPDATE TO authenticated
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

-- ---------------------------------------------------------------------------
-- Keep conversations.last_message_at aligned with newest message (insert-only path)
-- ---------------------------------------------------------------------------
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

COMMENT ON FUNCTION public.messages_bump_conversation_last_message_at () IS
  'Sets conversations.last_message_at from the inserted message created_at when newer.';

DROP TRIGGER IF EXISTS messages_bump_conversation_last_message_at ON public.messages;

CREATE TRIGGER messages_bump_conversation_last_message_at
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_bump_conversation_last_message_at ();

-- ---------------------------------------------------------------------------
-- Indexes: inbox queues + staff message attribution (supplements existing composites)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS conversations_dealership_inbox_unassigned_idx ON public.conversations (
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

CREATE INDEX IF NOT EXISTS conversations_dealership_assigned_active_idx ON public.conversations (
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

CREATE INDEX IF NOT EXISTS messages_sender_user_id_idx ON public.messages (sender_user_id)
WHERE
  sender_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customers_dealership_created_idx ON public.customers (
  dealership_id,
  created_at DESC);

COMMENT ON INDEX public.conversations_dealership_inbox_unassigned_idx IS
  'Unassigned queue: filter by department/status and sort by recency.';

COMMENT ON INDEX public.conversations_dealership_assigned_active_idx IS
  'My work / assigned active threads by dealership + assignee + status.';

COMMENT ON INDEX public.messages_sender_user_id_idx IS
  'Staff-sent messages and attribution queries.';

COMMENT ON INDEX public.customers_dealership_created_idx IS
  'Dealership-scoped customer lists ordered by signup/recency.';
