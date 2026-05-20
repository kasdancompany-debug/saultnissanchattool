-- Atomic human takeover + status changes: row lock, mutation, and conversation_events in one transaction.
-- Claim uses compare-and-swap rules when p_takeover is false so two staff cannot silently race on an unassigned thread.

-- Harden assign: do not move assignment on terminal conversations.
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

  IF r.status IN ('closed', 'archived', 'spam') THEN
    RAISE EXCEPTION 'CONVERSATION_TERMINAL'
      USING ERRCODE = 'P0001';
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
  'Atomically assigns owner; locks row, rejects terminal conversations, writes history + assignment_created.';

-- Claim / resume / takeover: metadata + status + AI assist + audit in one transaction.
CREATE OR REPLACE FUNCTION public.claim_conversation (
  p_dealership_id uuid,
  p_conversation_id uuid,
  p_staff_user_id uuid,
  p_takeover boolean
)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.conversations%ROWTYPE;
  v_prev uuid;
  v_prev_status public.conversation_status;
  v_next_status public.conversation_status;
  v_meta jsonb;
  v_prev_control jsonb;
  v_ai_was_disabled boolean;
  v_note text := 'claim';
BEGIN
  IF auth.uid () IS NOT NULL AND NOT public.user_has_dealership_write_access (p_dealership_id) THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.staff_users s
    WHERE
      s.id = p_staff_user_id
      AND s.dealership_id = p_dealership_id
      AND s.is_active = TRUE) THEN
    RAISE EXCEPTION 'INVALID_STAFF'
      USING ERRCODE = 'P0001';
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

  IF r.status IN ('closed', 'archived', 'spam') THEN
    RAISE EXCEPTION 'CONVERSATION_TERMINAL'
      USING ERRCODE = 'P0001';
  END IF;

  v_prev := r.assigned_to_user_id;
  v_prev_status := r.status;

  -- Compare-and-swap: without takeover, do not steal from another teammate (serialized by row lock).
  IF p_takeover THEN
    IF v_prev IS NOT DISTINCT FROM p_staff_user_id AND r.status <> 'waiting_for_human'::public.conversation_status THEN
      RAISE EXCEPTION 'ALREADY_CLAIMED'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF v_prev IS NULL THEN
      NULL;
    ELSIF v_prev IS NOT DISTINCT FROM p_staff_user_id AND r.status = 'waiting_for_human'::public.conversation_status THEN
      NULL;
    ELSIF v_prev IS NOT DISTINCT FROM p_staff_user_id THEN
      RAISE EXCEPTION 'ALREADY_CLAIMED'
        USING ERRCODE = 'P0001';
    ELSE
      RAISE EXCEPTION 'CLAIM_CONFLICT'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_next_status := CASE WHEN r.status = 'waiting_for_human'::public.conversation_status THEN
    'open'::public.conversation_status
  ELSE
    r.status
  END;

  v_prev_control := COALESCE(r.metadata #> '{control}', '{}'::jsonb);

  v_meta :=
    COALESCE(r.metadata, '{}'::jsonb) || jsonb_build_object(
      'control',
      v_prev_control || jsonb_build_object(
        'mode',
        to_jsonb ('human_led'::text),
        'ai_mode',
        to_jsonb ('assist'::text),
        'ai_autopilot',
        to_jsonb (FALSE),
        'claimed_at',
        to_jsonb (now()),
        'claimed_by',
        to_jsonb (p_staff_user_id)));

  v_ai_was_disabled := r.ai_enabled = FALSE;

  UPDATE
    public.conversations
  SET
    assigned_to_user_id = p_staff_user_id,
    ai_enabled = TRUE,
    status = v_next_status,
    metadata = v_meta,
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
    p_staff_user_id,
    p_staff_user_id,
    v_note,
    jsonb_build_object(
      'kind',
      'claim'));

  INSERT INTO public.conversation_events (
    conversation_id,
    event_type,
    actor_user_id,
    payload)
  VALUES (
    p_conversation_id,
    'assignment_created'::public.conversation_event_type,
    p_staff_user_id,
    jsonb_build_object(
      'assigned_to_user_id',
      to_jsonb (p_staff_user_id),
      'previous_assigned_to_user_id',
      to_jsonb (v_prev),
      'assigned_by_user_id',
      to_jsonb (p_staff_user_id),
      'kind',
      to_jsonb ('claim'::text)));

  IF v_prev_status IS DISTINCT FROM v_next_status THEN
    INSERT INTO public.conversation_events (
      conversation_id,
      event_type,
      actor_user_id,
      payload)
    VALUES (
      p_conversation_id,
      'status_changed'::public.conversation_event_type,
      p_staff_user_id,
      jsonb_build_object(
        'previous_status',
        to_jsonb (v_prev_status),
        'new_status',
        to_jsonb (v_next_status),
        'reason',
        to_jsonb ('human_takeover'::text)));
  END IF;

  IF v_ai_was_disabled THEN
    INSERT INTO public.conversation_events (
      conversation_id,
      event_type,
      actor_user_id,
      payload)
    VALUES (
      p_conversation_id,
      'ai_toggled'::public.conversation_event_type,
      p_staff_user_id,
      jsonb_build_object(
        'enabled',
        to_jsonb (TRUE),
        'mode',
        to_jsonb ('assist'::text),
        'note',
        to_jsonb ('Enabled for AI-assisted replies; human remains in control.'::text)));
  END IF;

  RETURN r;
END;
$$;

COMMENT ON FUNCTION public.claim_conversation (uuid, uuid, uuid, boolean) IS
  'Staff claim: FOR UPDATE, optional takeover, merges control metadata, assignment + status + ai events atomically.';

GRANT EXECUTE ON FUNCTION public.claim_conversation (uuid, uuid, uuid, boolean) TO authenticated;

GRANT EXECUTE ON FUNCTION public.claim_conversation (uuid, uuid, uuid, boolean) TO service_role;

-- Inbox status: pending / closed with row lock + single status_changed event.
CREATE OR REPLACE FUNCTION public.set_conversation_status (
  p_dealership_id uuid,
  p_conversation_id uuid,
  p_next_status public.conversation_status,
  p_actor_user_id uuid,
  p_reason text
)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.conversations%ROWTYPE;
  v_prev public.conversation_status;
BEGIN
  IF auth.uid () IS NOT NULL AND NOT public.user_has_dealership_write_access (p_dealership_id) THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.staff_users s
    WHERE
      s.id = p_actor_user_id
      AND s.dealership_id = p_dealership_id
      AND s.is_active = TRUE) THEN
    RAISE EXCEPTION 'INVALID_ACTOR'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_next_status NOT IN ('pending', 'closed') THEN
    RAISE EXCEPTION 'UNSUPPORTED_STATUS'
      USING ERRCODE = 'P0001';
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

  v_prev := r.status;

  IF v_prev IN ('closed', 'archived', 'spam') THEN
    RAISE EXCEPTION 'CONVERSATION_TERMINAL'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_next_status = 'pending' THEN
    IF v_prev = 'pending' THEN
      RAISE EXCEPTION 'ALREADY_PENDING'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_next_status = 'closed' THEN
    IF v_prev = 'closed' THEN
      RAISE EXCEPTION 'ALREADY_CLOSED'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE
    public.conversations
  SET
    status = p_next_status,
    updated_at = now()
  WHERE
    id = p_conversation_id
  RETURNING
    * INTO r;

  INSERT INTO public.conversation_events (
    conversation_id,
    event_type,
    actor_user_id,
    payload)
  VALUES (
    p_conversation_id,
    'status_changed'::public.conversation_event_type,
    p_actor_user_id,
    jsonb_build_object(
      'previous_status',
      to_jsonb (v_prev),
      'new_status',
      to_jsonb (p_next_status),
      'reason',
      to_jsonb (COALESCE(p_reason, ''))));

  RETURN r;
END;
$$;

COMMENT ON FUNCTION public.set_conversation_status (uuid, uuid, public.conversation_status, uuid, text) IS
  'Sets status to pending or closed with FOR UPDATE and one status_changed audit row.';

GRANT EXECUTE ON FUNCTION public.set_conversation_status (uuid, uuid, public.conversation_status, uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_conversation_status (uuid, uuid, public.conversation_status, uuid, text) TO service_role;
