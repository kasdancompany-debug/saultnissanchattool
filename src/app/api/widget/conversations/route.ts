import { NextResponse } from "next/server";

import { getWidgetSecrets, isWidgetConfigured } from "@/lib/env/widget";
import { assertWidgetApiKey } from "@/server/widget/widget-auth";
import { widgetJsonResponse, widgetOptionsSuccess } from "@/server/widget/widget-http";
import { clientIpFromRequest, isRateLimitError, rateLimitOrThrow } from "@/server/widget/rate-limit";
import { startWidgetConversation } from "@/server/widget/widget-public-service";
import { widgetStartBodySchema } from "@/server/widget/widget-schemas";

export async function OPTIONS(request: Request) {
  if (!isWidgetConfigured()) {
    return new NextResponse(null, { status: 503 });
  }
  try {
    const secrets = getWidgetSecrets();
    return widgetOptionsSuccess(request, secrets);
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isWidgetConfigured()) {
    return widgetJsonResponse(
      { error: { code: "NOT_CONFIGURED", message: "Widget API is not configured." } },
      503,
      request,
      null
    );
  }

  let secrets: ReturnType<typeof getWidgetSecrets>;
  try {
    secrets = getWidgetSecrets();
  } catch {
    return widgetJsonResponse(
      { error: { code: "NOT_CONFIGURED", message: "Invalid widget secrets." } },
      503,
      request,
      null
    );
  }

  try {
    assertWidgetApiKey(request, secrets.WIDGET_API_KEY);
    rateLimitOrThrow(`widget:start:${clientIpFromRequest(request)}`, 20);
  } catch (e) {
    if (isRateLimitError(e)) {
      return widgetJsonResponse(
        { error: { code: "RATE_LIMIT", message: "Too many requests." } },
        429,
        request,
        secrets
      );
    }
    return widgetJsonResponse(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized." } },
      401,
      request,
      secrets
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return widgetJsonResponse(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      400,
      request,
      secrets
    );
  }

  const parsed = widgetStartBodySchema.safeParse(body);
  if (!parsed.success) {
    return widgetJsonResponse(
      {
        error: {
          code: "VALIDATION",
          message: parsed.error.issues[0]?.message ?? "Validation failed",
        },
      },
      400,
      request,
      secrets
    );
  }

  const ua = request.headers.get("user-agent");

  const result = await startWidgetConversation(
    {
      dealershipSlug: parsed.data.dealership_slug,
      department: parsed.data.department,
      pagePath: parsed.data.page_path,
      displayName: parsed.data.display_name,
      email: parsed.data.email,
      phoneE164: parsed.data.phone_e164,
      userAgent: ua,
      leadCapture: parsed.data.lead_capture ?? null,
    },
    secrets.WIDGET_SESSION_SECRET
  );

  if (!result.ok) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return widgetJsonResponse(
      { error: { code: result.error.code, message: result.error.message } },
      status,
      request,
      secrets
    );
  }

  return widgetJsonResponse(
    {
      conversation_id: result.data.conversation_id,
      session_token: result.data.session_token,
      expires_at: result.data.expires_at,
      live_hours: result.data.live_hours,
    },
    200,
    request,
    secrets
  );
}
