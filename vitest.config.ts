import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "server-only": path.resolve(root, "test/shims/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: [path.resolve(root, "test/vitest.setup.ts")],
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
  },
});
