import type { PostgrestError } from "@supabase/supabase-js";

import { err, ok, type Err, type Result } from "@/server/result";

/** Maps Supabase PostgREST errors to stable `Result` failures. */
export function fromPostgrestError(
  error: PostgrestError | null,
  fallbackCode = "DATABASE_ERROR"
): Err {
  if (!error) {
    return err(fallbackCode, "Unknown database error");
  }

  switch (error.code) {
    case "PGRST116":
      return err("NOT_FOUND", error.message);
    case "23505":
      return err("CONFLICT", error.message);
    case "23514":
      return err("VALIDATION", error.message);
    case "23503":
      return err("FOREIGN_KEY_VIOLATION", error.message);
    case "42501":
      return err("FORBIDDEN", error.message);
    default:
      return err(fallbackCode, error.message);
  }
}

export function resultFromNullable<T>(
  data: T | null,
  notFoundMessage = "Record not found"
): Result<T> {
  if (data === null) {
    return err("NOT_FOUND", notFoundMessage);
  }
  return ok(data);
}
