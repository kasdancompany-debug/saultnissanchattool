import { STAFF_MESSAGE_MAX_CHARS } from "@/lib/staff-message-limits";
import { err, ok, type Result } from "@/server/result";

export { STAFF_MESSAGE_MAX_CHARS };

/**
 * Validates and normalizes a staff-typed message body.
 * Rejects blank / whitespace-only and enforces max length.
 */
export function validateStaffMessageBody(raw: unknown): Result<string> {
  if (raw == null) {
    return err("VALIDATION", "Message is required.");
  }

  const str = String(raw);
  const normalized = str.replace(/\r\n/g, "\n").trim();

  if (normalized.length === 0) {
    return err("VALIDATION", "Message cannot be empty.");
  }

  if (normalized.length > STAFF_MESSAGE_MAX_CHARS) {
    return err(
      "VALIDATION",
      `Message is too long (max ${STAFF_MESSAGE_MAX_CHARS.toLocaleString()} characters).`
    );
  }

  return ok(normalized);
}
