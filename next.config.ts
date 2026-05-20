import {
  applyEnvLocalOverrides,
  getNextPublicEnvForNextConfig,
} from "./env-local-override";

// Must run before Next reads `NEXT_PUBLIC_*` for the client bundle (Windows env can be wrong).
applyEnvLocalOverrides();

import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hard-embed `.env.local` NEXT_PUBLIC_* into the client JS bundle (overrides polluted OS env).
  env: getNextPublicEnvForNextConfig(),
  transpilePackages: ["geist"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
});
