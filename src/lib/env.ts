/**
 * Environment configuration entrypoint (client-safe).
 *
 * - Use `publicEnv` / `isSupabaseConfigured` here (safe for Client Components).
 * - For server secrets: `import { getServerEnv } from "@/lib/env/server"` inside server-only modules.
 * - Startup validation: `import { validateStartupEnv } from "@/lib/env/startup"` from `instrumentation.ts` only.
 */

export {
  getPublicEnv,
  isSupabaseConfigured,
  publicEnv,
  type PublicEnv,
} from "@/lib/env/public";
export type { ServerSecrets, StartupProductionEnv } from "@/lib/env/schema";
