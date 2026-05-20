import { z } from "zod";

const uuidSchema = z.string().uuid();

/**
 * Validates dynamic route `id` params (e.g. conversation UUID). Returns null if invalid.
 */
export function parseUuidRouteParam(raw: string): string | null {
  const t = raw.trim();
  const r = uuidSchema.safeParse(t);
  return r.success ? r.data : null;
}
