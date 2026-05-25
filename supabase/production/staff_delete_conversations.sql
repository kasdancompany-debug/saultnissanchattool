-- Run once in Supabase Dashboard → SQL Editor (production).
-- Enables permanent delete for all active staff without relying on Vercel service role.

-- (Contents match supabase/migrations/20260521120000_staff_delete_conversations.sql)

CREATE OR REPLACE FUNCTION public.staff_delete_conversations (
  p_dealership_id uuid,
  p_conversation_ids uuid[]
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_has_dealership_access (p_dealership_id) THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  IF p_conversation_ids IS NULL OR cardinality(p_conversation_ids) = 0 THEN
    RAISE EXCEPTION 'Select at least one conversation to delete.'
      USING ERRCODE = 'P0001';
  END IF;

  IF cardinality(p_conversation_ids) > 100 THEN
    RAISE EXCEPTION 'Delete at most 100 conversations at a time.'
      USING ERRCODE = 'P0001';
  END IF;

  WITH deleted AS (
    DELETE FROM public.conversations c
    WHERE c.dealership_id = p_dealership_id
      AND c.id = ANY (p_conversation_ids)
    RETURNING
      c.id)
  SELECT
    count(*)::integer INTO v_deleted
  FROM
    deleted;

  RETURN coalesce(v_deleted, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_delete_conversations (uuid, uuid[]) TO authenticated;

DROP POLICY IF EXISTS conversations_delete ON public.conversations;

CREATE POLICY conversations_delete ON public.conversations
  FOR DELETE TO authenticated
    USING (public.user_has_dealership_access (dealership_id));
