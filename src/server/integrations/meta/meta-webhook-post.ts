import "server-only";

import { ZodError } from "zod";

import { getMetaWebhookEnv } from "@/lib/env/meta-server";
import { parseInstagramWebhookPayload } from "@/server/integrations/meta/instagram/parse-instagram-webhook";
import { parseMessengerWebhookPayload } from "@/server/integrations/meta/messenger/parse-messenger-webhook";
import { parseMetaWebhookEnvelope } from "@/server/integrations/meta/parse-envelope";
import { applyMetaInboundNormalizedCores } from "@/server/integrations/meta/process-meta-inbound";
import { verifyMetaWebhookSignature } from "@/server/integrations/meta/verify-signature";

function envHint(e: unknown): string {
  return process.env.NODE_ENV === "development" && e instanceof ZodError
    ? e.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`).join("\n")
    : "Meta webhooks are not configured (set META_* in .env.local).";
}

/**
 * Receives Meta webhook POSTs: signature check, JSON parse, dispatch to Messenger / Instagram parsers,
 * then {@link applyMetaInboundNormalizedCores} → {@link applyInboundMessage} for each supported private text DM.
 */
export async function handleMetaWebhookPost(request: Request): Promise<Response> {
  let appSecret: string;
  try {
    appSecret = getMetaWebhookEnv().META_APP_SECRET;
  } catch (e) {
    return new Response(envHint(e), { status: 503 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get("x-hub-signature-256");

  if (!verifyMetaWebhookSignature(rawBody, sig, appSecret)) {
    return new Response("Forbidden", { status: 403 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const envelope = parseMetaWebhookEnvelope(parsed);
  if (!envelope.ok) {
    console.info("[meta webhook] envelope_rejected", { error: envelope.error });
    return new Response("Bad Request", { status: 400 });
  }

  // Intentionally avoid logging raw payloads (PII / tokens). Summaries only.
  if (envelope.object === "page") {
    const messenger = parseMessengerWebhookPayload(envelope);
    if (messenger.ok) {
      const ingest = await applyMetaInboundNormalizedCores(messenger.messages);
      const nonTextMessagingEvents = Math.max(
        0,
        messenger.summary.messagingEventCount - messenger.summary.inboundTextMessageCount
      );
      console.info("[meta webhook] messenger", {
        object: envelope.object,
        ...messenger.summary,
        nonTextMessagingEvents,
        ingest,
      });
    } else {
      console.info("[meta webhook] messenger_parse", { error: messenger.error });
    }
  } else if (envelope.object === "instagram") {
    const instagram = parseInstagramWebhookPayload(envelope);
    if (instagram.ok) {
      const ingest = await applyMetaInboundNormalizedCores(instagram.messages);
      const nonTextMessagingEvents = Math.max(
        0,
        instagram.summary.messagingEventCount - instagram.summary.inboundTextMessageCount
      );
      console.info("[meta webhook] instagram", {
        object: envelope.object,
        ...instagram.summary,
        nonTextMessagingEvents,
        ingest,
      });
    } else {
      console.info("[meta webhook] instagram_parse", { error: instagram.error });
    }
  } else {
    console.info("[meta webhook] unhandled_object", {
      object: envelope.object,
      entryCount: envelope.entry.length,
    });
  }

  return Response.json({ success: true }, { status: 200 });
}
