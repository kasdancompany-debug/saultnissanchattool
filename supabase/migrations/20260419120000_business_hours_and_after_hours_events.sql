-- Per-dealership business hours (JSON) and audit event for after-hours web intake.

ALTER TYPE public.conversation_event_type ADD VALUE IF NOT EXISTS 'after_hours_intake';

ALTER TABLE public.dealerships
ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.dealerships.business_hours IS
  'Structured weekly hours (web chat + optional per-department overrides). Empty {} uses app defaults.';

-- Default Sault Nissan: Mon–Fri 9:00–18:00, Sat–Sun closed, America/Toronto
UPDATE public.dealerships
SET
  business_hours = '{
    "version": 1,
    "timezone": "America/Toronto",
    "schedules": {
      "web_chat": {
        "mon": { "open": "09:00", "close": "18:00" },
        "tue": { "open": "09:00", "close": "18:00" },
        "wed": { "open": "09:00", "close": "18:00" },
        "thu": { "open": "09:00", "close": "18:00" },
        "fri": { "open": "09:00", "close": "18:00" },
        "sat": null,
        "sun": null
      }
    }
  }'::jsonb
WHERE
  slug = 'sault-nissan'
  AND business_hours = '{}'::jsonb;
