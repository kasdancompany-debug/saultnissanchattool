import "server-only";

import { ZodError } from "zod";

import { getMetaWebhookEnv } from "@/lib/env/meta-server";

/**
 * Meta GET webhook verification (`hub.mode`, `hub.verify_token`, `hub.challenge`).
 */
export function handleMetaWebhookGet(request: Request): Response {
  let verifyToken: string;
  try {
    verifyToken = getMetaWebhookEnv().META_VERIFY_TOKEN;
  } catch (e) {
    const hint =
      process.env.NODE_ENV === "development" && e instanceof ZodError
        ? e.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`).join("\n")
        : "Meta webhooks are not configured (set META_* in .env.local).";
    return new Response(hint, { status: 503 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken && challenge && challenge.length > 0) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}
