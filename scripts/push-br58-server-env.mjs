#!/usr/bin/env node
/** Push server-side env aliases (not inlined by Next at build). */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");

function parse(path) {
  const vars = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (v) vars[k] = v;
  }
  return vars;
}

const v = parse(envPath);
const pub = v.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || v.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const pairs = {
  SUPABASE_URL: v.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: pub,
  APP_URL: "https://saultnissanchattool-br58.vercel.app",
};

execSync("npx vercel link --project saultnissanchattool-br58 --yes", { cwd: root, stdio: "inherit" });

for (const [key, value] of Object.entries(pairs)) {
  if (!value) continue;
  console.log(`+ ${key}`);
  execSync(
    `npx vercel env add ${key} production --value ${JSON.stringify(value)} --yes --force`,
    { cwd: root, stdio: "inherit", timeout: 300_000 }
  );
}

console.log("Server env aliases done.");
