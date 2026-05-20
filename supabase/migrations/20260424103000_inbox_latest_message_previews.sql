-- One latest message per conversation for inbox list previews (correct under high volume).
-- Replaces heuristic global LIMIT scans that could miss conversations.

CREATE OR REPLACE FUNCTION public.inbox_latest_message_previews_for_dealership (
  p_dealership_id uuid,
  p_conversation_ids uuid[]
)
RETURNS TABLE (
  conversation_id uuid,
  body text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.body,
    m.created_at
  FROM public.messages m
  INNER JOIN public.conversations c ON c.id = m.conversation_id
  WHERE
    c.dealership_id = p_dealership_id
    AND m.conversation_id = ANY (p_conversation_ids)
  ORDER BY
    m.conversation_id,
    m.created_at DESC,
    m.id DESC;
$$;

COMMENT ON FUNCTION public.inbox_latest_message_previews_for_dealership (uuid, uuid[]) IS
  'Returns the newest message per conversation for inbox preview; scoped by dealership.';

GRANT EXECUTE ON FUNCTION public.inbox_latest_message_previews_for_dealership (uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_latest_message_previews_for_dealership (uuid, uuid[]) TO service_role;
