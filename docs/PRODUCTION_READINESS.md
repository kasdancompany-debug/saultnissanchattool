# Production readiness — chat platform

This document summarizes hardening work applied in-repo and **remaining risks** before production use.

## Implemented improvements

### Input validation

- Widget message routes validate `conversation_id` path segments as **UUIDs** before auth/DB work (`parseUuidRouteParam`).
- Public APIs already use **Zod** where applicable (missed-call JSON, widget bodies). Twilio inbound relies on signature verification + downstream validation in `processTwilioInboundSms` (`src/server/integrations/twilio/persist-inbound-sms.ts`). **`TWILIO_ACCOUNT_SID`**, **`TWILIO_AUTH_TOKEN`**, and **`TWILIO_PHONE_NUMBER`** are validated on **production** server boot (`validateStartupEnv`) and via **`getTwilioServerEnv()`** on Twilio-only code paths (`src/lib/env/twilio-server.ts`); in **development**, Twilio may be omitted until you exercise SMS (see `src/lib/env/startup.ts`).

### Error boundaries

- **Dashboard** root `error.tsx` reports to **Sentry** and offers reset (covers Overview, Settings, etc., except nested routes with their own boundary).
- **Inbox** `error.tsx` now uses **Sentry** (tag `surface: inbox`) instead of only `console.error`.

### Server error handling & observability

- **`captureServerException` / `capturePipelineFailure`** (`src/lib/observability/server-capture.ts`): logs to stderr and **`Sentry.captureException`** — no silent swallow.
- **Inbound AI scheduling** (`scheduleInboundClassification`): failures are **captured** with dealership/conversation/message context (previously empty `.catch()`).
- **Missed-call department routing hook**: DB update failures and missing **audit events** now **report to Sentry** (previously silent `return`).
- **Twilio SMS webhook**: unexpected throws wrapped; **5xx Result paths** call Sentry before responding.
- **Missed-call webhook**: unexpected throws captured; **HTTP status** uses **`httpStatusForServiceError`** (validation → 4xx, server/DB → 5xx).

### HTTP status semantics

- **`httpStatusForServiceError`** centralizes mapping (`VALIDATION` / `NO_PHONE` / `UNKNOWN_DEALERSHIP` → 400, `NOT_FOUND` → 404, `CONFLICT` → 409, else 500).
- Applied to **Twilio status callback**, **widget messages** GET/POST Result errors, and **missed-call** handler responses.

### Webhook idempotency & retry safety

- **Twilio inbound SMS**: idempotent on **`MessageSid`** / `twilio_inbound_sid`; duplicate → success TwiML (retry-safe for Twilio).
- **Twilio status**: idempotent **upsert** of latest status by `twilio_outbound_sid`.
- **Missed-call**: idempotent when **`externalCallId`** present (**`telephony_event_dedupe`** unique constraint).

### Serverless / timeouts

- **`maxDuration = 60`** on Twilio + telephony webhook routes to reduce timeout risk on Vercel-style hosts.

### Rate limiting (documentation)

- **Widget** in-memory limits documented as **non-durable**; production should use **Redis / edge** limits (see `src/server/widget/rate-limit.ts`).

---

## Sentry — where it’s wired vs recommended

| Area | Status |
|------|--------|
| Next `instrumentation` / `onRequestError` | Already configured |
| `global-error.tsx` | Captures |
| Dashboard + Inbox route error boundaries | Captures |
| Background pipeline (`scheduleInboundClassification`) | **Now captures** |
| Missed-call routing hook failures | **Now captures** |
| Twilio SMS **5xx** from Result | **Now captures** |
| Missed-call webhook **unexpected** throw | **Now captures** |
| **Server Actions** (inbox reply, settings) | Rely on `onRequestError`; add **manual capture** on critical `!result.ok` if you need business-context tags |
| **`loadDealershipAnalytics`** / heavy data loaders | Consider **`Sentry.startSpan`** for latency visibility in production |

---

## Monitoring & alerting (recommended)

- **Twilio**: Dashboard for **delivery errors**, **status callback** volume, and **403** on webhooks (signature / URL mismatch).
- **Supabase**: Monitor **RLS denials**, **DB CPU**, **slow queries** on `messages` + `conversation_events` (analytics-style aggregations).
- **API**: Track **429** on widget routes (rate limit), **401/403** on webhooks, **5xx** rate by route.
- **Background work**: Alert on **Sentry** issue rate for `pipeline: inbound_classification` and `missed_call_*` fingerprints.
- **Queues**: If you add a job queue later, monitor **DLQ depth** and **processing lag** (not applicable yet).

---

## Remaining risks (before go-live)

1. **Widget rate limit** is **per-process memory** — unfair under multi-instance deploy; abuse or uneven load balancing weakens protection.
2. **Analytics** (`loadDealershipAnalytics`) can be **heavy** on large message tables; may need **SQL aggregates** or **materialized views** before scale.
3. **Twilio status callback** does not append an **audit `conversation_event`** per status update — compliance may want a sampled or terminal-state-only event.
4. **`tryApplyMissedCallDepartmentReply`** still returns early without capture when **`getConversationById`** fails (could be rare race); optional improvement.
5. **No request body size limit** explicitly set on API routes — rely on platform defaults; define **max JSON/body size** at edge if needed.
6. **OpenAI / AI pipeline**: failures are stored on `message_ai_runs` but **operator visibility** depends on Sentry + DB inspection; consider a **dead-letter** or **admin banner** for repeated failures.
7. **Secrets**: Confirmed patterns avoid exposing secrets in browser; keep **rotation** and **least-privilege** Supabase keys as operational tasks.

---

## Fragile spots identified in review

- **Fire-and-forget** patterns: only `scheduleInboundClassification` was hardened; any future `void foo().catch(() => {})` should use the same **capture** pattern.
- **Result errors mapped to HTTP**: new code should use **`httpStatusForServiceError`** (or extend it) for consistency.
- **Duplicate `json()` helpers** across widget routes — consider a shared helper with **request ID** for tracing (optional).

This file is intended to evolve with runbooks and on-call policy.
