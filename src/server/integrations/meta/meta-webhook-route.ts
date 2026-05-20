import "server-only";

import { handleMetaWebhookGet } from "@/server/integrations/meta/meta-webhook-get";
import { handleMetaWebhookPost } from "@/server/integrations/meta/meta-webhook-post";

export const runtime = "nodejs";
export const maxDuration = 60;

export function GET(request: Request): Response {
  return handleMetaWebhookGet(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleMetaWebhookPost(request);
}
