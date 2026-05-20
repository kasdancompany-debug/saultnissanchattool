import { NextResponse } from "next/server";
import { z } from "zod";

import { httpStatusForServiceError } from "@/lib/http/map-result-to-http-status";
import { captureServerException } from "@/lib/observability/server-capture";
import { getServerEnv } from "@/lib/env/server";
import { handleMissedCallEvent } from "@/server/telephony/missed-call-service";

export const runtime = "nodejs";

export const maxDuration = 60;

const bodySchema = z.object({
  provider: z.string().min(1).max(128),
  callerE164: z.string().min(1).max(40),
  dialedE164: z.string().min(1).max(40).optional().nullable(),
  dealershipId: z.string().uuid().optional().nullable(),
  externalCallId: z.string().max(512).optional().nullable(),
  raw: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * Provider-agnostic missed-call hook. Map any telephony vendor payload to the JSON
 * shape validated by `bodySchema`, then forward here (Bearer auth).
 */
export async function POST(request: Request) {
  let expectedSecret: string;
  try {
    expectedSecret = getServerEnv().MISSED_CALL_WEBHOOK_SECRET.trim();
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "MISSED_CALL_WEBHOOK_SECRET is not set" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await handleMissedCallEvent({
      provider: parsed.data.provider,
      callerE164: parsed.data.callerE164,
      dialedE164: parsed.data.dialedE164 ?? undefined,
      dealershipId: parsed.data.dealershipId ?? undefined,
      externalCallId: parsed.data.externalCallId ?? undefined,
      raw: parsed.data.raw ?? undefined,
    });
  } catch (error) {
    captureServerException(error, { route: "POST /api/webhooks/telephony/missed-call" });
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Unexpected server error." } },
      { status: 500 }
    );
  }

  if (!result.ok) {
    const status = httpStatusForServiceError(result.error.code);
    return NextResponse.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status }
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
