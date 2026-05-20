import "server-only";

import { NextResponse } from "next/server";

import type { WidgetSecrets } from "@/lib/env/widget";

import { widgetCorsHeaders } from "@/server/widget/cors";

/**
 * JSON responses for widget API routes — applies CORS when `secrets` is set.
 */
export function widgetJsonResponse(
  data: unknown,
  status: number,
  request: Request,
  secrets: WidgetSecrets | null
): NextResponse {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (secrets) {
    const c = widgetCorsHeaders(request, secrets);
    Object.entries(c).forEach(([k, v]) => headers.set(k, v));
  }
  return NextResponse.json(data, { status, headers });
}

export function widgetOptionsSuccess(
  request: Request,
  secrets: WidgetSecrets
): NextResponse {
  const headers = new Headers(widgetCorsHeaders(request, secrets));
  return new NextResponse(null, { status: 204, headers });
}
