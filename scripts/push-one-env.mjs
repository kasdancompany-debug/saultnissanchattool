#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [, , key, value] = process.argv;
if (!key || !value) {
  console.error("Usage: node scripts/push-one-env.mjs KEY VALUE");
  process.exit(1);
}

const r = spawnSync(
  "npx",
  ["vercel", "env", "add", key, "production", "--value", value, "--yes", "--force"],
  { cwd: root, stdio: "inherit", shell: true, timeout: 600_000 }
);
process.exit(r.status ?? 1);
