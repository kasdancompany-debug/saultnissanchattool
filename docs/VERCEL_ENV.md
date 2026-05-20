# Vercel environment variables

Add these in **Vercel → Project → Settings → Environment Variables**. Enable **Production** and **Preview**, then **Redeploy**.

## Required (app will not work without these)

| Variable | Example / notes |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon JWT, **or** use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` (no trailing slash) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; widget + webhooks |
| `OPENAI_API_KEY` | AI classification + widget replies |

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
