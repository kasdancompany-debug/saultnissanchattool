-- AI ↔ human takeover: new audit event types + claim_conversation emits human_claimed / ai_assist_enabled
-- and stamps metadata.control.handling_mode = claimed_by_staff.

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE
      n.nspname = 'public'
      AND t.typname = 'conversation_event_type'
      AND e.enumlabel = 'ai_reply_sent'
  ) THEN
    ALTER TYPE public.conversation_event_type ADD VALUE 'ai_reply_sent';
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE
      n.nspname = 'public'
      AND t.typname = 'conversation_event_type'
      AND e.enumlabel = 'waiting_for_human'
  ) THEN
    ALTER TYPE public.conversation_event_type ADD VALUE 'waiting_for_human';
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE
      n.nspname = 'public'
      AND t.typname = 'conversation_event_type'
      AND e.enumlabel = 'human_claimed'
  ) THEN
    ALTER TYPE public.conversation_event_type ADD VALUE 'human_claimed';
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE
      n.nspname = 'public'
      AND t.typname = 'conversation_event_type'
      AND e.enumlabel = 'human_reply_sent'
  ) THEN
    ALTER TYPE public.conversation_event_type ADD VALUE 'human_reply_sent';
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE
      n.nspname = 'public'
      AND t.typname = 'conversation_event_type'
      AND e.enumlabel = 'ai_assist_enabled'
  ) THEN
    ALTER TYPE public.conversation_event_type ADD VALUE 'ai_assist_enabled';
  END IF;
END
$migration$;

COMMENT ON TYPE public.conversation_event_type IS
  'Includes ai_reply_sent, waiting_for_human, human_claimed, human_reply_sent, ai_assist_enabled for AI↔human workflow.';

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
        'handling_mode',
        to_jsonb ('claimed_by_staff'::text),
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

  INSERT INTO public.conversation_events (
    conversation_id,
    event_type,
    actor_user_id,
    payload)
  VALUES (
    p_conversation_id,
    'human_claimed'::public.conversation_event_type,
    p_staff_user_id,
    jsonb_build_object(
      'staff_user_id',
      to_jsonb (p_staff_user_id),
      'takeover',
      to_jsonb (p_takeover),
      'previous_assigned_to_user_id',
      to_jsonb (v_prev)));

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
      'ai_assist_enabled'::public.conversation_event_type,
      p_staff_user_id,
      jsonb_build_object(
        'ai_mode',
        to_jsonb ('assist'::text),
        'ai_autopilot',
        to_jsonb (FALSE),
        'note',
        to_jsonb ('Assist-only drafts; human sends customer-facing messages.'::text)));
  END IF;

  RETURN r;
END;
$$;

COMMENT ON FUNCTION public.claim_conversation (uuid, uuid, uuid, boolean) IS
  'Staff claim: FOR UPDATE, stamps human-led control + handling_mode claimed_by_staff, human_claimed audit, optional ai_assist_enabled when AI was off.';
