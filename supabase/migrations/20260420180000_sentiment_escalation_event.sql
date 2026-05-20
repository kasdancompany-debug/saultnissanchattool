-- Event type for sentiment / escalation-risk detection (AI + keyword fallback).

DO $$
BEGIN
  ALTER TYPE public.conversation_event_type ADD VALUE 'sentiment_escalation';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

COMMENT ON TYPE public.conversation_event_type IS
  'Includes sentiment_escalation for strong negative sentiment or escalation-risk signals.';
