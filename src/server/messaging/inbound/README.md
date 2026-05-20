# Provider-agnostic inbound pipeline

**Channel adapters** now live under **`@/server/inbox`** (`src/server/inbox/`). This folder keeps normalized types, **`applyInboundMessage`**, and post-hooks.

## Shapes

- **`InboundNormalizedCore`** (`normalized-inbound-message.ts`): fields every adapter maps from its webhook/API (no I/O).
- **`NormalizedInboundMessage`**: core plus **`dealershipId`** and optional **`targetConversationId`** when the thread already exists (e.g. web widget).
- **`applyInboundMessage()`** (`apply-inbound-message.ts`): shared server flow — customer + conversation resolution, dedupe, insert message, hooks.
- **`runPostInboundMessageHooks()`** (`post-inbound-hooks.ts`): SMS missed-call + classification (invoked from `applyInboundMessage` after insert).

See **`src/server/inbox/README.md`** for the adapter contract (`parse` → `validate` → `normalize` → `ingest`).

## DB channel mapping

Product `channel` values map to `conversations.channel` with **`toDbConversationChannel()`** (Messenger/Instagram → `facebook`, WhatsApp → `other`, etc.).

## Imports

Prefer **`import { … } from "@/server/inbox"`** for adapters and **`import { … } from "@/server/messaging/inbound"`** when you only need types + `applyInboundMessage` (both are valid; `server/inbox` re-exports the messaging surface).

This `adapters/` directory re-exports from `@/server/inbox` for backward compatibility.
