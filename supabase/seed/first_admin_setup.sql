-- =============================================================================
-- FIRST ADMIN (MANUAL, CONTROLLED) — Sault Nissan Comms
-- =============================================================================
-- There is NO auto-registration. You run SQL in the Supabase SQL Editor (or psql)
-- with the service role / dashboard SQL — never expose this pattern to anonymous clients.
--
-- PREREQUISITES
--   • All migrations applied (schema includes public.dealerships, public.staff_users).
--   • A Supabase Auth user already exists for this person (invite or create in Dashboard).
--
-- HOW TO GET THE AUTH USER ID (required for staff_users.id)
--   1. Open Supabase Dashboard → Authentication → Users.
--   2. Find the user (by email).
--   3. Open the user row → copy the field labeled **User UID** (a UUID).
--      That value is auth.users.id. It is NOT the same as staff_users until you insert below.
--
-- HOW IT CONNECTS TO staff_users
--   • Table public.staff_users has PRIMARY KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE.
--   • You MUST set staff_users.id to exactly that User UID.
--   • staff_users.email MUST match the Auth email (lowercase), per CHECK constraint.
--   • Role for first admin: 'admin' (enum public.staff_role).
--   • is_active must be TRUE or the app will treat the user as unauthorized.
--
-- RUN ORDER
--   1) Run SECTION A once (dealership row).
--   2) Edit SECTION B: replace the three quoted literals (auth id, email, display name).
--   3) Run SECTION B once.
--   4) Sign in at /login with that Auth user.
--
-- ROLLBACK: see supabase/seed/rollback_first_admin.sql
-- =============================================================================


-- ---------------------------------------------------------------------------
-- SECTION A — Dealership tenant (run first; safe to re-run via ON CONFLICT)
-- ---------------------------------------------------------------------------
BEGIN;

INSERT INTO public.dealerships (name, slug, timezone)
  VALUES ('Sault Nissan', 'sault-nissan', 'America/Toronto')
ON CONFLICT (slug)
  DO UPDATE SET
    name = EXCLUDED.name,
    timezone = EXCLUDED.timezone
  RETURNING
    id,
    slug;

COMMIT;

-- Verify:
--   SELECT id, slug, name FROM public.dealerships WHERE slug = 'sault-nissan';


-- ---------------------------------------------------------------------------
-- SECTION B — Link first admin (edit ALL placeholders, then run as one script)
-- ---------------------------------------------------------------------------
-- Replace before running:
--   1) AUTH_USER_ID          → full UUID from Dashboard → Authentication → Users → User UID
--      (must be an existing auth.users row or INSERT will fail FK staff_users_id_fkey)
--   2) admin email            → exactly that user's email, lowercase (matches Auth)
--   3) display name           → label shown in the app (e.g. "Jane Admin")
--
-- Do NOT run until SECTION A succeeded and slug 'sault-nissan' exists.

BEGIN;

INSERT INTO public.staff_users (
  id,
  dealership_id,
  email,
  display_name,
  role,
  department,
  is_active,
  metadata
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid, -- REPLACE this UUID with the real User UID
  d.id,
  'replace-with-admin@example.com', -- REPLACE with same email as Auth (lowercase)
  'Replace With Real Name', -- REPLACE
  'admin'::public.staff_role,
  'management'::public.staff_department,
  TRUE,
  '{}'::jsonb
FROM
  public.dealerships d
WHERE
  d.slug = 'sault-nissan'
LIMIT 1;

COMMIT;

-- If you see "0 rows inserted", the SELECT found no dealership — run SECTION A first.
-- If you see a unique violation on staff_users_pkey, this auth user is already linked;
-- use rollback or UPDATE instead of INSERT (see rollback file).


-- ---------------------------------------------------------------------------
-- Optional: confirm row (run in SQL Editor)
-- ---------------------------------------------------------------------------
-- SELECT su.id, su.email, su.role, su.is_active, d.slug
-- FROM public.staff_users su
-- JOIN public.dealerships d ON d.id = su.dealership_id
-- WHERE su.email = 'replace-with-admin@example.com';
