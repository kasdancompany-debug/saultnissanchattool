#!/usr/bin/env node
/**
 * Sync .env.local → Vercel (production + preview).
 * Usage: node scripts/sync-vercel-env.mjs <vercel-project> <NEXT_PUBLIC_APP_URL>
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const project = process.argv[2];
const appUrl = process.argv[3];

if (!project || !appUrl) {
  console.error(
    "Usage: node scripts/sync-vercel-env.mjs <vercel-project> <NEXT_PUBLIC_APP_URL>"
  );
  process.exit(1);
}

const envPath = join(root, ".env.local");
if (!existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

function parseEnvFile(path) {
  const vars = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val.length > 0) vars[key] = val;
  }
  return vars;
}

const vars = parseEnvFile(envPath);
vars.NEXT_PUBLIC_APP_URL = appUrl;

if (!vars.NEXT_PUBLIC_SUPABASE_ANON_KEY && vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  vars.NEXT_PUBLIC_SUPABASE_ANON_KEY = vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

if (vars.NEXT_PUBLIC_SUPABASE_URL) vars.SUPABASE_URL = vars.NEXT_PUBLIC_SUPABASE_URL;
if (vars.NEXT_PUBLIC_SUPABASE_ANON_KEY) vars.SUPABASE_ANON_KEY = vars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (vars.NEXT_PUBLIC_APP_URL) vars.APP_URL = vars.NEXT_PUBLIC_APP_URL;

const environments = ["production", "preview"];

console.log(`\n=== ${project} → ${appUrl} ===\n`);
execSync(`npx vercel link --project ${project} --yes`, { cwd: root, stdio: "inherit" });

for (const [key, value] of Object.entries(vars)) {
  for (const env of environments) {
    console.log(`  + ${key} (${env})`);
    execSync(
      `npx vercel env add ${key} ${env} --value ${JSON.stringify(value)} --yes --force`,
      { cwd: root, stdio: "inherit" }
    );
  }
}

console.log("\nDone. Redeploy production so NEXT_PUBLIC_* are baked into the client bundle.\n");
