import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { applyEnvLocalOverrides } = await import("../env-local-override");
    applyEnvLocalOverrides();
    // Instrumentation runs before Next merges `.env*` into `process.env`; load explicitly.
    // Dynamic import keeps `@next/env` out of the Edge instrumentation bundle (`__import_unsupported`).
    const { loadEnvConfig } = await import("@next/env");
    loadEnvConfig(process.cwd());
    const { validateStartupEnv } = await import("@/lib/env/startup");
    try {
      validateStartupEnv();
    } catch (error) {
      console.error("[env] Startup validation failed:", error);
    }
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
