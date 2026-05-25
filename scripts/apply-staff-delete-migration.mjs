#!/usr/bin/env node
/**
 * Apply staff_delete_conversations migration to the linked Supabase project.
 * Uses SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL from .env.local.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}

const env = loadEnv(envPath);
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const projectRef = env.SUPABASE_PROJECT_REF?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sqlPath = join(
  root,
  "supabase/migrations/20260521120000_staff_delete_conversations.sql"
);
const sql = readFileSync(sqlPath, "utf8");

const ref =
  projectRef ||
  (() => {
    try {
      return new URL(url).hostname.split(".")[0];
    } catch {
      return null;
    }
  })();

if (!ref) {
  console.error("Could not derive Supabase project ref from URL");
  process.exit(1);
}

const managementToken =
  env.SUPABASE_ACCESS_TOKEN?.trim() || env.SUPABASE_MANAGEMENT_TOKEN?.trim();

async function runViaManagementApi() {
  if (!managementToken) {
    return false;
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.text();
  if (!res.ok) {
    console.error("Management API failed:", res.status, body.slice(0, 500));
    return false;
  }
  console.log("Migration applied via Supabase Management API.");
  return true;
}

async function runViaRpcProbe() {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const probe = await supabase.rpc("staff_delete_conversations", {
    p_dealership_id: "00000000-0000-0000-0000-000000000000",
    p_conversation_ids: [],
  });
  if (!probe.error || probe.error.code !== "PGRST202") {
    console.log("staff_delete_conversations already exists on database.");
    return true;
  }
  return false;
}

const already = await runViaRpcProbe();
if (already) {
  process.exit(0);
}

const applied = await runViaManagementApi();
if (applied) {
  process.exit(0);
}

console.error(`
Could not auto-apply migration.

Option A — Supabase Dashboard → SQL Editor → paste and run:
  ${sqlPath}

Option B — CLI (if linked):
  npx supabase db push

Option C — set SUPABASE_ACCESS_TOKEN in .env.local and re-run:
  node scripts/apply-staff-delete-migration.mjs
`);
process.exit(1);
