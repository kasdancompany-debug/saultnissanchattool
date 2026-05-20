-- Row Level Security + helpers for multi-tenant dealership access via staff_users ↔ auth.users
-- Uses SECURITY DEFINER helpers so policy checks do not recurse through staff_users RLS.

-- ---------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER: read staff_users without triggering RLS recursion)
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

COMMENT ON FUNCTION public.user_has_dealership_access (uuid) IS 'True when the current auth user is an active staff member for the given dealership.';

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

COMMENT ON FUNCTION public.current_staff_is_privileged () IS 'Admin or manager for any dealership the user belongs to (single-dealership today; extend when staff can span stores).';

GRANT EXECUTE ON FUNCTION public.user_has_dealership_access (uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_staff_is_privileged () TO authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.dealerships ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- dealerships
-- ---------------------------------------------------------------------------
CREATE POLICY dealerships_select ON public.dealerships
  FOR SELECT TO authenticated
    USING (user_has_dealership_access (id));

CREATE POLICY dealerships_update ON public.dealerships
  FOR UPDATE TO authenticated
    USING (user_has_dealership_access (id)
      AND current_staff_is_privileged ())
    WITH CHECK (user_has_dealership_access (id)
      AND current_staff_is_privileged ());

-- ---------------------------------------------------------------------------
-- staff_users (directory: same dealership; updates: self or privileged)
-- ---------------------------------------------------------------------------
CREATE POLICY staff_users_select ON public.staff_users
  FOR SELECT TO authenticated
    USING (user_has_dealership_access (dealership_id));

CREATE POLICY staff_users_update ON public.staff_users
  FOR UPDATE TO authenticated
    USING (user_has_dealership_access (dealership_id)
      AND (id = auth.uid ()
        OR current_staff_is_privileged ()))
    WITH CHECK (user_has_dealership_access (dealership_id)
      AND (id = auth.uid ()
        OR current_staff_is_privileged ()));

-- No INSERT/DELETE for authenticated — provision users via service role / SQL / dashboard tools.

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
CREATE POLICY customers_select ON public.customers
  FOR SELECT TO authenticated
    USING (user_has_dealership_access (dealership_id));

CREATE POLICY customers_insert ON public.customers
  FOR INSERT TO authenticated
    WITH CHECK (user_has_dealership_access (dealership_id));

CREATE POLICY customers_update ON public.customers
  FOR UPDATE TO authenticated
    USING (user_has_dealership_access (dealership_id))
    WITH CHECK (user_has_dealership_access (dealership_id));

CREATE POLICY customers_delete ON public.customers
  FOR DELETE TO authenticated
    USING (user_has_dealership_access (dealership_id)
      AND current_staff_is_privileged ());

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
CREATE POLICY conversations_select ON public.conversations
  FOR SELECT TO authenticated
    USING (user_has_dealership_access (dealership_id));

CREATE POLICY conversations_insert ON public.conversations
  FOR INSERT TO authenticated
    WITH CHECK (user_has_dealership_access (dealership_id));

CREATE POLICY conversations_update ON public.conversations
  FOR UPDATE TO authenticated
    USING (user_has_dealership_access (dealership_id))
    WITH CHECK (user_has_dealership_access (dealership_id));

CREATE POLICY conversations_delete ON public.conversations
  FOR DELETE TO authenticated
    USING (user_has_dealership_access (dealership_id)
      AND current_staff_is_privileged ());

-- ---------------------------------------------------------------------------
-- messages (scoped via parent conversation)
-- ---------------------------------------------------------------------------
CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT
        1
      FROM
        public.conversations c
      WHERE
        c.id = messages.conversation_id
        AND user_has_dealership_access (c.dealership_id)));

CREATE POLICY messages_insert ON public.messages
  FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT
        1
      FROM
        public.conversations c
      WHERE
        c.id = messages.conversation_id
        AND user_has_dealership_access (c.dealership_id)));

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
        AND user_has_dealership_access (c.dealership_id)));

CREATE POLICY messages_delete ON public.messages
  FOR DELETE TO authenticated
    USING (EXISTS (
      SELECT
        1
      FROM
        public.conversations c
      WHERE
        c.id = messages.conversation_id
        AND user_has_dealership_access (c.dealership_id)
        AND current_staff_is_privileged ()));

-- ---------------------------------------------------------------------------
-- conversation_events (append-only: no UPDATE)
-- ---------------------------------------------------------------------------
CREATE POLICY conversation_events_select ON public.conversation_events
  FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT
        1
      FROM
        public.conversations c
      WHERE
        c.id = conversation_events.conversation_id
        AND user_has_dealership_access (c.dealership_id)));

CREATE POLICY conversation_events_insert ON public.conversation_events
  FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT
        1
      FROM
        public.conversations c
      WHERE
        c.id = conversation_events.conversation_id
        AND user_has_dealership_access (c.dealership_id)));

-- ---------------------------------------------------------------------------
-- conversation_assignments
-- ---------------------------------------------------------------------------
CREATE POLICY conversation_assignments_select ON public.conversation_assignments
  FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT
        1
      FROM
        public.conversations c
      WHERE
        c.id = conversation_assignments.conversation_id
        AND user_has_dealership_access (c.dealership_id)));

CREATE POLICY conversation_assignments_insert ON public.conversation_assignments
  FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT
        1
      FROM
        public.conversations c
      WHERE
        c.id = conversation_assignments.conversation_id
        AND user_has_dealership_access (c.dealership_id)));

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
        AND user_has_dealership_access (c.dealership_id)));

CREATE POLICY conversation_assignments_delete ON public.conversation_assignments
  FOR DELETE TO authenticated
    USING (EXISTS (
      SELECT
        1
      FROM
        public.conversations c
      WHERE
        c.id = conversation_assignments.conversation_id
        AND user_has_dealership_access (c.dealership_id)
        AND current_staff_is_privileged ()));
