# Sault Nissan Comms

Next.js app for dealership messaging workflows (inbox, settings, analytics, and channel integrations).

## Local Setup

1. Install dependencies:
   - `npm install`
2. Copy env template:
   - create `.env.local` from `.env.example`
3. Fill required values in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - one of `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (usually `http://localhost:3042`)
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER` (E.164 format, e.g. `+17055550100`)
4. Start dev server:
   - `npm run preflight`
   - `npm run dev`
   - optional combined command: `npm run dev:checked`
5. Open:
   - [http://localhost:3042](http://localhost:3042)

## Environment Contract

`src/lib/env/startup.ts` validates startup env at boot:
- **Development boot requires** public vars + Twilio (`TWILIO_*`) so webhook/outbound flows fail fast.
- **Production boot requires** full public + server secret contract.
- `SKIP_ENV_VALIDATION=1` is for exceptional build contexts only; do not use in production runtime.

`src/lib/env/schema.ts` is the source of truth for env keys and defaults.

## Startup Failure Troubleshooting

If the app fails during startup with an environment error:
- Read the `[env] Invalid ... environment` log block; it lists exact invalid/missing keys.
- Compare your `.env.local` against `.env.example`.
- Ensure Twilio secrets are **not** prefixed with `NEXT_PUBLIC_`.
- Confirm `TWILIO_PHONE_NUMBER` is strict E.164.
- Restart the dev server after changes.
- For local setup checks without starting Next.js, run `npm run preflight`.

## CI checks

The CI workflow blocks merges when any of these fail:
- `npm run preflight:template` (env template contract)
- `npm run test:env` (env boundary tests)
- `npm run lint`

## Related docs

- Twilio integration details: `src/server/integrations/twilio/README.md`
- Inbox adapter architecture: `src/server/inbox/README.md`
