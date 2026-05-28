-- Staff shared an external service scheduling deep link with the customer.

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
      AND e.enumlabel = 'service_scheduler_link_sent'
  ) THEN
    ALTER TYPE public.conversation_event_type ADD VALUE 'service_scheduler_link_sent';
  END IF;
END
$migration$;

COMMENT ON TYPE public.conversation_event_type IS
  'Includes service_scheduler_link_sent when staff insert or send the configured external service scheduler URL.';
