import type { NextResponse } from "next/server";

/**
 * Preserves Set-Cookie headers when issuing a new middleware response (e.g. redirect).
 */
export function copyCookiesToResponse(
  source: NextResponse,
  target: NextResponse
): void {
  for (const c of source.cookies.getAll()) {
    target.cookies.set(c.name, c.value);
  }
}
