/**
 * One-off: reads .env.local and checks Supabase Auth accepts the public API key.
 * Usage: node scripts/verify-supabase-keys.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const p = join(process.cwd(), ".env.local");
if (!existsSync(p)) {
  console.error("No .env.local");
  process.exit(1);
}

const env = {};
for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (key.startsWith("NEXT_PUBLIC_")) env[key] = val;
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const pub = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
const apiKey = anon || pub;

if (!url || !apiKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or a public key in .env.local");
  process.exit(1);
}

const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
  headers: { apikey: apiKey },
});

const body = await res.text();
console.log("GET /auth/v1/health");
console.log("status:", res.status);
console.log("body:", body.slice(0, 200));
if (res.status === 401 || body.includes("Invalid API key")) {
  console.error(
    "\nThis key is rejected by Supabase for this project URL. Copy a fresh anon or publishable key from Project Settings → API (same project as the URL)."
  );
  process.exit(2);
}

const tokenRes = await fetch(
  `${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
  {
    method: "POST",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: "test@example.com", password: "wrong-password-check" }),
  }
);
const tokenBody = await tokenRes.text();
console.log("\nPOST /auth/v1/token (expect 400 bad login, not 401 invalid key)");
console.log("status:", tokenRes.status);
console.log("body:", tokenBody.slice(0, 120));
if (tokenRes.status === 401 && tokenBody.includes("Invalid API key")) {
  console.error("\nToken route rejects this apikey (same as browser sign-in).");
  process.exit(3);
}
