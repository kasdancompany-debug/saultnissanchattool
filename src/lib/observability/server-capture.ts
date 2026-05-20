import * as Sentry from "@sentry/nextjs";

/**
 * Reports an unexpected error from server-only code (routes, actions, background work).
 * Always logs; sends to Sentry when configured (never swallows silently).
 */
export function captureServerException(
  error: unknown,
  context: Record<string, unknown> = {}
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("[server-error]", JSON.stringify(context), err);
  Sentry.captureException(err, { extra: context });
}

/**
 * Fire-and-forget pipelines (e.g. post-inbound AI) — failures must be visible in Sentry/logs.
 */
export function capturePipelineFailure(
  pipeline: string,
  error: unknown,
  extra?: Record<string, unknown>
): void {
  captureServerException(error, { pipeline, ...extra });
}
