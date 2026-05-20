-- Staff composed a reply in the product (inbox); distinct from provider-level message_outbound delivery.

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
      AND e.enumlabel = 'staff_reply'
  ) THEN
    ALTER TYPE public.conversation_event_type ADD VALUE 'staff_reply';
  END IF;
END
$migration$;

COMMENT ON TYPE public.conversation_event_type IS
  'Includes staff_reply when a staff user submits a reply from the inbox (message row persisted).';
