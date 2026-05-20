import { NextResponse } from "next/server";

import { getWidgetSecrets, isWidgetConfigured } from "@/lib/env/widget";
import { httpStatusForServiceError } from "@/lib/http/map-result-to-http-status";
import { parseUuidRouteParam } from "@/lib/validation/params";
import {
  assertWidgetApiKey,
  readWidgetSessionToken,
} from "@/server/widget/widget-auth";
import { widgetJsonResponse, widgetOptionsSuccess } from "@/server/widget/widget-http";
import { clientIpFromRequest, isRateLimitError, rateLimitOrThrow } from "@/server/widget/rate-limit";
import {
  listWidgetMessages,
  postWidgetCustomerMessage,
} from "@/server/widget/widget-public-service";
import { widgetPostMessageBodySchema } from "@/server/widget/widget-schemas";
import { verifyWidgetSessionToken } from "@/lib/widget/session-token";

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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawConversationId } = await context.params;
  const conversationId = parseUuidRouteParam(rawConversationId);

  if (!conversationId) {
    return widgetJsonResponse(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid conversation id.",
        },
      },
      400,
      request,
      null
    );
  }

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
    rateLimitOrThrow(`widget:poll:${clientIpFromRequest(request)}`, 120);
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

  const token = readWidgetSessionToken(request);
  if (!token) {
    return widgetJsonResponse(
      { error: { code: "UNAUTHORIZED", message: "Missing session token." } },
      401,
      request,
      secrets
    );
  }

  const payload = verifyWidgetSessionToken(token, secrets.WIDGET_SESSION_SECRET);
  if (!payload || payload.conversationId !== conversationId) {
    return widgetJsonResponse(
      { error: { code: "UNAUTHORIZED", message: "Invalid or expired session." } },
      401,
      request,
      secrets
    );
  }

  const result = await listWidgetMessages({
    dealershipId: payload.dealershipId,
    conversationId,
    limit: 100,
  });

  if (!result.ok) {
    const status = httpStatusForServiceError(result.error.code);
    return widgetJsonResponse(
      { error: { code: result.error.code, message: result.error.message } },
      status,
      request,
      secrets
    );
  }

  return widgetJsonResponse({ messages: result.data }, 200, request, secrets);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawConversationId } = await context.params;
  const conversationId = parseUuidRouteParam(rawConversationId);

  if (!conversationId) {
    return widgetJsonResponse(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid conversation id.",
        },
      },
      400,
      request,
      null
    );
  }

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
    rateLimitOrThrow(`widget:msg:${clientIpFromRequest(request)}`, 60);
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

  const token = readWidgetSessionToken(request);
  if (!token) {
    return widgetJsonResponse(
      { error: { code: "UNAUTHORIZED", message: "Missing session token." } },
      401,
      request,
      secrets
    );
  }

  const payload = verifyWidgetSessionToken(token, secrets.WIDGET_SESSION_SECRET);
  if (!payload || payload.conversationId !== conversationId) {
    return widgetJsonResponse(
      { error: { code: "UNAUTHORIZED", message: "Invalid or expired session." } },
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

  const parsed = widgetPostMessageBodySchema.safeParse(body);
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

  const result = await postWidgetCustomerMessage({
    dealershipId: payload.dealershipId,
    conversationId,
    body: parsed.data.text.trim(),
  });

  if (!result.ok) {
    const status = httpStatusForServiceError(result.error.code);
    return widgetJsonResponse(
      { error: { code: result.error.code, message: result.error.message } },
      status,
      request,
      secrets
    );
  }

  return widgetJsonResponse(
    {
      id: result.data.id,
      created_at: result.data.created_at,
    },
    200,
    request,
    secrets
  );
}
