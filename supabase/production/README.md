# Production schema (greenfield)

## How to use

- **New Supabase project:** run `dealership_chat_platform.sql` once in the SQL Editor (or via `psql`). The database must not already define these tables/enums.
- **This repo’s incremental history:** use `supabase/migrations/` in order (`supabase db push`). Do **not** run the greenfield script on top of an already-migrated database.

Additional features (AI runs, telephony dedupe, business hours, inbox preview RPC, Realtime publication, etc.) live in separate migrations under `supabase/migrations/`; apply those if you need parity with the full application.

---

## Tables

### `dealerships`

Tenant root. Every other business table either references `dealerships.id` directly (`dealership_id`) or indirectly (e.g. via `conversations`). Supports future multi-dealership by scoping all queries and RLS on `dealership_id`. Optional `slug` for human-readable routing; `timezone` for scheduling and display; `twilio_phone_e164` for SMS routing and uniqueness per provisioned number.

### `staff_users`

Maps `auth.users` to a dealership: `id` is the Supabase Auth user UUID. Stores directory fields (`email`, `display_name`), `role` (including `readonly` for view-only), `department`, and `is_active`. **Current model:** one `dealership_id` per row. For staff who work at multiple stores, introduce a membership table later and evolve RLS helpers without dropping the tenant column pattern.

### `customers`

CRM-style end customers scoped by `dealership_id`. Identity fields (`email`, `phone_e164`) are optional until known; partial unique indexes prevent duplicate email/phone per dealership when set.

### `conversations`

Omnichannel thread: `channel`, `department`, `status` (including `waiting_for_human`), `priority`, `sentiment`, `ai_enabled`, `assigned_to_user_id`, optional `customer_id`, `title`, and JSON `metadata`. `last_message_at` is denormalized for inbox ordering and is updated by a trigger when new `messages` rows are inserted.

### `messages`

Thread body and provider metadata: `sender_type` (`customer` / `staff` / `system` / `ai`), `sender_user_id` required for `staff`, Twilio SIDs for idempotency and status callbacks, `delivery_status`, `raw_payload`, `metadata`. Check constraint enforces sender consistency. Cascading delete from `conversations`.

### `conversation_events`

Append-only audit stream: `event_type` (lifecycle, assignments, messages, integrations, `staff_reply`, etc.), `actor_user_id`, JSON `payload`. No `UPDATE` RLS policy by design; immutability is enforced by omitting an update policy (only superuser/service role can bypass).

### `conversation_assignments`

Historical ownership changes: `assigned_to_user_id`, optional `assigned_by_user_id`, `note`, `metadata`. Current assignee is mirrored on `conversations.assigned_to_user_id` for fast inbox filters; this table is the audit trail.

---

## Indexes (inbox-oriented)

- **Recency:** `dealership_id` + `last_message_at` (and variants with `status`, `department`, `assigned_to_user_id`) for queue views and “mine” / unassigned / team inboxes.
- **Partial indexes** for active unassigned and assigned “open queue” statuses (`open`, `pending`, `waiting_for_human`).
- **Messages:** `(conversation_id, created_at)` for transcript order; `sender_user_id` for staff attribution; delivery status for retries.
- **Events / assignments:** conversation-scoped time ordering for timelines and history.

---

## RLS policies (summary)

All listed tables use **Row Level Security**. Access is based on the JWT’s `auth.uid()` matching `staff_users.id` and the row’s dealership.

### Helper functions

| Function | Purpose |
|----------|---------|
| `user_has_dealership_access(dealership_id)` | Active staff row for that dealership (read access). |
| `user_has_dealership_write_access(dealership_id)` | Same, but role is not `readonly` (insert/update operational data). |
| `current_staff_is_privileged()` | `admin` or `manager` (for settings-style updates and privileged deletes). |

Helpers are **`SECURITY DEFINER`** so policies can read `staff_users` without recursive RLS checks.

### Policy patterns

- **`dealerships`:** SELECT if staff belongs to that dealership; UPDATE only if privileged.
- **`staff_users`:** SELECT all rows in the same dealership; UPDATE self or privileged (no INSERT/DELETE for `authenticated` — provisioning uses service role / SQL).
- **`customers` / `conversations`:** SELECT with access; INSERT/UPDATE with **write** access; DELETE only privileged (destructive).
- **`messages` / `conversation_events` / `conversation_assignments`:** Access is **derived through `conversations`**: the user must have access (and usually write access for mutations) to the parent conversation’s dealership.

**Service role** (Edge Functions, webhooks, server-side admin) bypasses RLS; keep automation on service role keys, not anon keys.

**Readonly staff** can list and open threads but cannot insert/update operational rows (per `user_has_dealership_write_access`).

---

## Multi-dealership (future)

The schema is already **tenant-keyed**: every business row carries `dealership_id` or joins to it. Next steps when a user can belong to multiple dealerships:

1. Add `staff_memberships` (or similar): `(staff_id, dealership_id, role, ...)`.
2. Replace `user_has_dealership_access` with a version that checks membership rows.
3. Optionally keep `staff_users.dealership_id` as “primary” store for backward compatibility during migration.

No demo or placeholder tables are included in this script.
