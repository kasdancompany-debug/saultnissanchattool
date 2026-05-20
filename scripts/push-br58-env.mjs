#!/usr/bin/env node
/** Fast push .env.local → Vercel production for saultnissanchattool-br58 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
const project = "saultnissanchattool-br58";
const appUrl = "https://saultnissanchattool-br58.vercel.app";

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

if (!existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const vars = parseEnvFile(envPath);
if (vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !vars.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  vars.NEXT_PUBLIC_SUPABASE_ANON_KEY = vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}
vars.NEXT_PUBLIC_APP_URL = appUrl;

const keys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "AI_INBOUND_CLASSIFICATION_ENABLED",
  "AI_SERVICE_AFTER_HOURS_AUTOREPLY",
];

execSync(`npx vercel link --project ${project} --yes`, { cwd: root, stdio: "inherit" });

for (const key of keys) {
  if (!vars[key]) continue;
  console.log(`+ ${key}`);
  execSync(
    `npx vercel env add ${key} production --value ${JSON.stringify(vars[key])} --yes --force`,
    { cwd: root, stdio: "inherit" }
  );
}

console.log("Env sync done.");
