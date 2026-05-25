"use client";

import { mergeClientPublicEnv } from "@/lib/env/client-public-runtime";
import { publicEnv } from "@/lib/env/public";
import type { PublicEnv } from "@/lib/env/schema";

/** Client-side public env: prefers server-injected JSON, then build-time `NEXT_PUBLIC_*`. */
export function getClientPublicEnv(): PublicEnv {
  return mergeClientPublicEnv(publicEnv);
}
