-- Queue state: escalated / needs human before automation continues
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'conversation_status'
      AND e.enumlabel = 'waiting_for_human'
  ) THEN
    ALTER TYPE public.conversation_status ADD VALUE 'waiting_for_human';
  END IF;
END
$migration$;
