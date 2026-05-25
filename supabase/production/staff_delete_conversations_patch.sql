-- Re-run if delete still fails after the first staff_delete_conversations.sql.
-- Fixes service-role server deletes (auth.uid() is null on Vercel admin client).

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
  IF auth.uid () IS NOT NULL
    AND NOT public.user_has_dealership_access (p_dealership_id) THEN
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
