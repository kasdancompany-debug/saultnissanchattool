-- =============================================================================
-- ROLLBACK / FIX MISTAKES — first admin seed (manual)
-- =============================================================================
-- Use when you linked the wrong Auth user, wrong email, or need to remove access
-- before re-running SECTION B of first_admin_setup.sql.
--
-- SAFETY
--   • Run in a transaction (BEGIN … COMMIT) and review row counts before COMMIT.
--   • Deleting staff_users does NOT delete the Auth user (auth.users) — only removes
--     the app’s staff profile. The person can still sign in to Supabase Auth but will
--     hit /unauthorized until a new staff_users row exists.
--   • Deleting the dealership is destructive if conversations/messages exist — only
--     do that on a fresh project. Prefer deleting staff_users first.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- OPTION 1 — Remove staff profile only (most common rollback)
-- ---------------------------------------------------------------------------
-- Replace PASTE_AUTH_USER_UUID with the same UUID you used for staff_users.id.

BEGIN;

DELETE FROM public.staff_users
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid; -- REPLACE with the same User UID used in seed

-- Expected: DELETE 1. If 0, UUID did not match any row.

COMMIT;


-- ---------------------------------------------------------------------------
-- OPTION 2 — Fix email / display name / role without deleting (if row exists)
-- ---------------------------------------------------------------------------

BEGIN;

UPDATE public.staff_users
SET
  email = 'corrected@example.com',
  display_name = 'Corrected Name',
  role = 'admin'::public.staff_role,
  is_active = TRUE,
  updated_at = now()
WHERE
  id = '00000000-0000-0000-0000-000000000001'::uuid; -- REPLACE with User UID

COMMIT;


-- ---------------------------------------------------------------------------
-- OPTION 3 — Remove dealership (ONLY on empty / dev database)
-- ---------------------------------------------------------------------------
-- Deletes the Sault Nissan row only if you are sure no dependent data should remain.
-- CASCADE from migrations may remove child rows — verify project state first.

/*
BEGIN;

DELETE FROM public.dealerships
WHERE slug = 'sault-nissan';

COMMIT;
*/


-- ---------------------------------------------------------------------------
-- OPTION 4 — Delete Auth user (Dashboard preferred)
-- ---------------------------------------------------------------------------
-- In Supabase Dashboard → Authentication → Users → select user → Delete user.
-- staff_users will CASCADE delete if FK is ON DELETE CASCADE (staff_users.id → auth.users).
-- Prefer removing staff_users first if you only want to unlink app access but keep Auth.
