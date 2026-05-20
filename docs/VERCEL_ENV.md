# Vercel environment variables

Add these in **Vercel → Project → Settings → Environment Variables**. Enable **Production** and **Preview**, then **Redeploy**.

## Required (login + inbox will 500 without these)

Set these **before** deploy, then **Redeploy** so `NEXT_PUBLIC_*` are baked into the client bundle.

| Variable | Example / notes |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` (real project URL, not a placeholder) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon JWT, **or** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
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

## Optional

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG` | Default `sault-nissan` |
| `WIDGET_SESSION_SECRET` | Widget session signing |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error reporting |
| `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN` | Meta webhooks |

Copy values from local `.env.local`. **Do not** commit `.env.local` to Git.

## Supabase Auth

Add your Vercel URL to Supabase **Authentication → URL configuration** (Site URL + redirect URLs) so login and password reset work.
