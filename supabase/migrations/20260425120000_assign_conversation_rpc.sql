-- Atomic assign: conversation row + history + assignment_created event in one transaction.
-- Avoids inconsistent state when PostgREST would otherwise run three separate round-trips.

CREATE OR REPLACE FUNCTION public.assign_conversation (
  p_dealership_id uuid,
  p_conversation_id uuid,
  p_assigned_to_user_id uuid,
  p_assigned_by_user_id uuid,
  p_note text
)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.conversations%ROWTYPE;
  v_prev uuid;
  v_kind text;
BEGIN
  IF auth.uid () IS NOT NULL AND NOT public.user_has_dealership_write_access (p_dealership_id) THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    * INTO r
  FROM
    public.conversations c
  WHERE
    c.id = p_conversation_id
    AND c.dealership_id = p_dealership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVERSATION_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  v_prev := r.assigned_to_user_id;

  IF v_prev IS NOT DISTINCT FROM p_assigned_to_user_id THEN
    RAISE EXCEPTION 'ALREADY_ASSIGNED'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.staff_users s
    WHERE
      s.id = p_assigned_to_user_id
      AND s.dealership_id = p_dealership_id
      AND s.is_active = TRUE) THEN
    RAISE EXCEPTION 'INVALID_ASSIGNEE'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_assigned_by_user_id IS NOT NULL AND NOT EXISTS (
    SELECT
      1
    FROM
      public.staff_users s
    WHERE
      s.id = p_assigned_by_user_id
      AND s.dealership_id = p_dealership_id
      AND s.is_active = TRUE) THEN
    RAISE EXCEPTION 'INVALID_ACTOR'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE
    public.conversations
  SET
    assigned_to_user_id = p_assigned_to_user_id,
    updated_at = now()
  WHERE
    id = p_conversation_id
  RETURNING
    * INTO r;

  INSERT INTO public.conversation_assignments (
    conversation_id,
    assigned_to_user_id,
    assigned_by_user_id,
    note,
    metadata)
  VALUES (
    p_conversation_id,
    p_assigned_to_user_id,
    p_assigned_by_user_id,
    p_note,
    '{}'::jsonb);

  v_kind := CASE WHEN p_note = 'reassign' THEN
    'reassign'
  WHEN p_note = 'claim' THEN
    'claim'
  ELSE
    'assign'
  END;

  INSERT INTO public.conversation_events (
    conversation_id,
    event_type,
    actor_user_id,
    payload)
  VALUES (
    p_conversation_id,
    'assignment_created'::public.conversation_event_type,
    p_assigned_by_user_id,
    jsonb_build_object(
      'assigned_to_user_id',
      to_jsonb (p_assigned_to_user_id),
      'previous_assigned_to_user_id',
      to_jsonb (v_prev),
      'assigned_by_user_id',
      to_jsonb (p_assigned_by_user_id),
      'note',
      to_jsonb (p_note),
      'kind',
      to_jsonb (v_kind)));

  RETURN r;
END;
$$;

COMMENT ON FUNCTION public.assign_conversation (uuid, uuid, uuid, uuid, text) IS
  'Atomically sets conversations.assigned_to_user_id, appends conversation_assignments, and records assignment_created.';

GRANT EXECUTE ON FUNCTION public.assign_conversation (uuid, uuid, uuid, uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.assign_conversation (uuid, uuid, uuid, uuid, text) TO service_role;
