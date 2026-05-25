#!/usr/bin/env node
/** Push only Supabase/auth env vars needed for sign-in. */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const project = process.argv[2] ?? "saultnissanchattool";
const appUrl =
  process.argv[3] ?? "https://saultnissanchattool.vercel.app";
const envPath = join(root, ".env.local");

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

const src = parseEnvFile(envPath);
const anon =
  src.NEXT_PUBLIC_SUPABASE_ANON_KEY || src.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!src.NEXT_PUBLIC_SUPABASE_URL || !anon) {
  console.error("Missing Supabase URL or anon/publishable key in .env.local");
  process.exit(1);
}

const vars = {
  NEXT_PUBLIC_SUPABASE_URL: src.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    src.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? anon,
  NEXT_PUBLIC_APP_URL: appUrl,
  SUPABASE_URL: src.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: anon,
  APP_URL: appUrl,
  SUPABASE_SERVICE_ROLE_KEY: src.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: src.OPENAI_API_KEY,
};

const environments = ["production", "preview"];

execSync(`npx vercel link --project ${project} --yes`, { cwd: root, stdio: "inherit" });

for (const env of environments) {
  for (const [key, value] of Object.entries(vars)) {
    if (!value) continue;
    console.log(`+ ${key} (${env})`);
    execSync(
      `npx vercel env add ${key} ${env} --value ${JSON.stringify(value)} --yes --force`,
      { cwd: root, stdio: "inherit", maxBuffer: 10 * 1024 * 1024 }
    );
  }
}

console.log("Auth env push complete.");
