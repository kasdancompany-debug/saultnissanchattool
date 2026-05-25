# Vercel environment variables

Add these in **Vercel → Project → Settings → Environment Variables**. Enable **Production** and **Preview**, then **Redeploy**.

## Required (login + inbox will 500 without these)

Set these **before** deploy, then **Redeploy** so `NEXT_PUBLIC_*` are baked into the client bundle.

| Variable | Example / notes |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` (real project URL, not a placeholder) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon JWT — if you only have a **publishable** key (`sb_publishable_…`), set this to the same value (or set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_ANON_KEY` for server runtime) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional if anon JWT is set; required on Vercel when anon is intentionally empty locally |
| `SUPABASE_ANON_KEY` | Server alias (same value as anon/publishable) — ensures login works when Next does not expose `NEXT_PUBLIC_*` at runtime |
| `SUPABASE_URL` | Server alias for `NEXT_PUBLIC_SUPABASE_URL` |
| `APP_URL` | Server alias for `NEXT_PUBLIC_APP_URL` |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` (no trailing slash) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; widget + webhooks |
| `OPENAI_API_KEY` | AI classification + widget replies |

If the site shows **500** on `/login`, the deployment is usually missing one of the rows above, or you added variables but did not **Redeploy**.

## Twilio (SMS)

| Variable |
|----------|
| `TWILIO_ACCOUNT_SID` |
| `TWILIO_AUTH_TOKEN` |
| `TWILIO_PHONE_NUMBER` | E.164, e.g. `+17055550100` |

## Widget embed (required for web chat on dealer site)

Without **`WIDGET_SESSION_SECRET`** (32+ characters), `POST /api/widget/conversations` returns **503** and no inbox thread is created.

| Variable | Purpose |
|----------|---------|
| `WIDGET_SESSION_SECRET` | Signs widget session tokens (min 32 chars) — **required in production** |
| `WIDGET_API_KEY` | Optional shared secret; if set, also set `NEXT_PUBLIC_WIDGET_API_KEY` to the same value |
| `NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG` | Default `sault-nissan` for `/widget` |

Push from local: `node scripts/push-widget-env.mjs` then **Redeploy**.

## Optional

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error reporting |
| `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN` | Meta webhooks |

Copy values from local `.env.local`. **Do not** commit `.env.local` to Git.

## Supabase database migrations

Widget AI replies and staff takeover events require migration `20260428100000_ai_human_takeover_events.sql` (adds `ai_reply_sent` and related enum values). If that migration was never applied, the app will still send AI messages after deploy, but audit events may be skipped until you run:

`supabase db push` (or apply migrations in the Supabase SQL editor).

## Supabase Auth

Add your Vercel URL to Supabase **Authentication → URL configuration** (Site URL + redirect URLs) so login and password reset work.
