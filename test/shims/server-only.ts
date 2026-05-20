/**
 * Vitest resolves `server-only` to this empty module so Next.js server entrypoints
 * (e.g. `applyInboundMessage`) can load under Node without the real `server-only` stub
 * that throws outside the Next bundler.
 */

export {};
