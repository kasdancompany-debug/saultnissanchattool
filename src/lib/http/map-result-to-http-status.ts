/**
 * Maps internal `Result` error codes to HTTP status for API routes.
 */
export function httpStatusForServiceError(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "VALIDATION":
    case "UNKNOWN_DEALERSHIP":
    case "NO_PHONE":
      return 400;
    default:
      return 500;
  }
}
