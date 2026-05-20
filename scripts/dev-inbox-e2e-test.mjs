#!/usr/bin/env node
/**
 * Development-only end-to-end inbox test: creates an isolated dealership + Auth user + staff +
 * customer + conversations + messages, then runs lightweight DB checks (sort order, assignment).
 *
 * Does NOT start Next.js — open /inbox in the browser manually after a successful run.
 *
 * SAFETY (read before running)
 * ───────────────────────────
 * • Uses SUPABASE_SERVICE_ROLE_KEY (full DB access). Never commit it; never expose to clients.
 * • Set DEV_INBOX_TEST_ALLOW=1 only when targeting a local or disposable Supabase project — not production.
 * • Prefer local Supabase (`supabase start`) or a dedicated dev project URL.
 * • The script creates real Auth users and rows tagged in metadata for `npm run test:inbox-e2e -- --clean`.
 * • `--force` skips the allow check — only for CI with throwaway databases.
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import process from "node:process";

const SEED_TAG = "dev_inbox_e2e_v1";

function parseArgs(argv) {
  const clean = argv.includes("--clean");
  const help = argv.includes("--help") || argv.includes("-h");
  const force = argv.includes("--force");
  return { clean, help, force };
}

function printHelp() {
  console.log(`
dev-inbox-e2e-test.mjs

Creates (unless --clean): dealership, Auth user, staff_users, customer, 2 conversations,
messages — then verifies sort order and assignment (RPC or fallback).

Environment (required):
  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Safety gate (required unless --force):
  DEV_INBOX_TEST_ALLOW=1

  PowerShell:  $env:DEV_INBOX_TEST_ALLOW="1"; npm run test:inbox-e2e
  cmd.exe:      set DEV_INBOX_TEST_ALLOW=1 && npm run test:inbox-e2e

Optional:
  --clean     Remove the last run's rows (dealership tagged ${SEED_TAG}) and its Auth user
  --force     Skip DEV_INBOX_TEST_ALLOW check (dangerous — only for CI with a throwaway project)

Flags:
  --help
`);
}

function assertEnvAllow(force) {
  if (force) {
    console.warn(
      "[dev-inbox-e2e] --force: skipping DEV_INBOX_TEST_ALLOW (use only on disposable DBs).\n"
    );
    return;
  }
  if (process.env.DEV_INBOX_TEST_ALLOW !== "1") {
    console.error(
      "Refusing to run: set DEV_INBOX_TEST_ALLOW=1 for local / dev Supabase only.\n" +
        "Never point this at production data."
    );
    process.exit(1);
  }
}

async function cleanTrackedRun(supabase) {
  const { data: deals, error: dealListErr } = await supabase
    .from("dealerships")
    .select("id, slug")
    .contains("metadata", { dev_seed: SEED_TAG });

  if (dealListErr) {
    console.error("dealerships lookup failed:", dealListErr.message);
    process.exit(1);
  }

  if (!deals?.length) {
    console.log("Nothing to clean (no dealership with dev_seed tag).");
    return;
  }

  for (const d of deals) {
    const { data: staffRows, error: staffErr } = await supabase
      .from("staff_users")
      .select("id")
      .eq("dealership_id", d.id)
      .contains("metadata", { dev_seed: SEED_TAG });

    if (staffErr) {
      console.error("staff_users lookup failed:", staffErr.message);
      process.exit(1);
    }

    const staffIds = (staffRows ?? []).map((r) => r.id);

    const { error: delConvErr } = await supabase
      .from("conversations")
      .delete()
      .eq("dealership_id", d.id);

    if (delConvErr) {
      console.error("Delete conversations failed:", delConvErr.message);
      process.exit(1);
    }

    const { error: delCustErr } = await supabase
      .from("customers")
      .delete()
      .eq("dealership_id", d.id);

    if (delCustErr) {
      console.error("Delete customers failed:", delCustErr.message);
      process.exit(1);
    }

    for (const uid of staffIds) {
      const { error: delAuthErr } = await supabase.auth.admin.deleteUser(uid);
      if (delAuthErr) {
        console.warn("auth.admin.deleteUser:", uid, delAuthErr.message);
      } else {
        console.log("Removed Auth user:", uid);
      }
    }

    const { error: delDealErr } = await supabase.from("dealerships").delete().eq("id", d.id);
    if (delDealErr) {
      console.error("Delete dealership failed:", delDealErr.message);
      process.exit(1);
    }

    console.log("Clean complete. Removed dealership:", d.slug ?? d.id);
  }
}

async function verifySortOrder(supabase, dealershipId, newerId, olderId) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, last_message_at")
    .eq("dealership_id", dealershipId)
    .in("id", [newerId, olderId])
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Sort check query failed:", error.message);
    process.exit(1);
  }
  if (!data?.length || data[0].id !== newerId) {
    console.error("FAIL: expected newer conversation first by last_message_at DESC.");
    process.exit(1);
  }
  console.log("✓ Sort check: newest activity conversation sorts first (matches inbox list).");
}

async function verifyAssignment(supabase, dealershipId, conversationId, staffId) {
  const { error: clearErr } = await supabase
    .from("conversations")
    .update({ assigned_to_user_id: null, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("dealership_id", dealershipId);

  if (clearErr) {
    console.error("Assignment prep (unassign) failed:", clearErr.message);
    process.exit(1);
  }

  const { data: rpcRow, error: rpcErr } = await supabase.rpc("assign_conversation", {
    p_dealership_id: dealershipId,
    p_conversation_id: conversationId,
    p_assigned_to_user_id: staffId,
    p_assigned_by_user_id: staffId,
    p_note: "assign",
  });

  if (rpcErr) {
    console.warn(
      "assign_conversation RPC unavailable (apply migrations?):",
      rpcErr.message
    );
    const { error: upErr } = await supabase
      .from("conversations")
      .update({ assigned_to_user_id: staffId, updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("dealership_id", dealershipId);
    if (upErr) {
      console.error("Assignment fallback failed:", upErr.message);
      process.exit(1);
    }
    console.log("✓ Assignment (fallback): assigned_to_user_id set via update.");
    return;
  }

  if (!rpcRow) {
    console.error("RPC returned no row.");
    process.exit(1);
  }
  console.log("✓ Assignment: assign_conversation RPC succeeded.");
}

async function main() {
  const { clean, help, force } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    process.exit(0);
  }

  assertEnvAllow(force);

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const hostHint = supabaseUrl.replace(/^(https?:\/\/[^/]+).*/, "$1");
  console.log("[dev-inbox-e2e] Service role client →", hostHint);

  if (clean) {
    await cleanTrackedRun(supabase);
    process.exit(0);
  }

  const runId = Date.now().toString(36);
  const slug = `dev-inbox-e2e-${runId}`;
  const seedMeta = { dev_seed: SEED_TAG };
  const email = `dev.inbox.e2e.${runId}@example.com`;

  const password = `${randomUUID()}Aa1!`;

  const { data: createdUser, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: seedMeta,
  });

  if (authErr || !createdUser?.user?.id) {
    console.error("auth.admin.createUser failed:", authErr?.message ?? "no user");
    process.exit(1);
  }

  const staffUserId = createdUser.user.id;

  const { data: dealership, error: dealErr } = await supabase
    .from("dealerships")
    .insert({
      name: "Dev Inbox E2E (disposable)",
      slug,
      timezone: "America/Toronto",
      metadata: seedMeta,
    })
    .select("id")
    .single();

  if (dealErr || !dealership) {
    console.error("Insert dealership failed:", dealErr?.message);
    await supabase.auth.admin.deleteUser(staffUserId);
    process.exit(1);
  }

  const dealershipId = dealership.id;

  const { error: staffInsErr } = await supabase.from("staff_users").insert({
    id: staffUserId,
    dealership_id: dealershipId,
    email,
    display_name: "Dev E2E Staff",
    role: "advisor",
    department: "sales",
    is_active: true,
    metadata: seedMeta,
  });

  if (staffInsErr) {
    console.error("Insert staff_users failed:", staffInsErr.message);
    await supabase.from("dealerships").delete().eq("id", dealershipId);
    await supabase.auth.admin.deleteUser(staffUserId);
    process.exit(1);
  }

  const phoneDigits = String(now % 10_000_000).padStart(7, "0");
  const phone_e164 = `+1555${phoneDigits}`;

  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .insert({
      dealership_id: dealershipId,
      display_name: "E2E Customer",
      phone_e164,
      email: `e2e.customer.${runId}@example.com`,
      metadata: seedMeta,
    })
    .select("id")
    .single();

  if (custErr || !customer) {
    console.error("Insert customer failed:", custErr?.message);
    process.exit(1);
  }

  const customerId = customer.id;

  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();

  const { data: convs, error: convErr } = await supabase
    .from("conversations")
    .insert([
      {
        dealership_id: dealershipId,
        customer_id: customerId,
        channel: "web_chat",
        department: "sales",
        status: "open",
        sentiment: "neutral",
        ai_enabled: false,
        assigned_to_user_id: staffUserId,
        title: "[E2E] Older thread",
        metadata: { ...seedMeta, e2e_sort: "older" },
      },
      {
        dealership_id: dealershipId,
        customer_id: customerId,
        channel: "web_chat",
        department: "sales",
        status: "open",
        sentiment: "neutral",
        ai_enabled: false,
        assigned_to_user_id: staffUserId,
        title: "[E2E] Newer thread",
        metadata: { ...seedMeta, e2e_sort: "newer" },
      },
    ])
    .select("id, title, metadata");

  if (convErr || !convs?.length) {
    console.error("Insert conversations failed:", convErr?.message);
    process.exit(1);
  }

  const olderConv = convs.find((c) => c.metadata?.e2e_sort === "older");
  const newerConv = convs.find((c) => c.metadata?.e2e_sort === "newer");
  if (!olderConv || !newerConv) {
    console.error("Internal error: conversation rows not found.");
    process.exit(1);
  }

  const tOlderMsg = now - 120 * 60_000;
  const tNewerMsg = now - 1 * 60_000;

  const messages = [
    {
      conversation_id: olderConv.id,
      sender_type: "customer",
      sender_user_id: null,
      body: "Older conv: first message.",
      delivery_status: "delivered",
      raw_payload: {},
      metadata: seedMeta,
      created_at: iso(tOlderMsg),
    },
    {
      conversation_id: newerConv.id,
      sender_type: "customer",
      sender_user_id: null,
      body: "Newer conv: latest activity (should sort above older).",
      delivery_status: "delivered",
      raw_payload: {},
      metadata: seedMeta,
      created_at: iso(tNewerMsg),
    },
  ];

  const { error: msgErr } = await supabase.from("messages").insert(messages);
  if (msgErr) {
    console.error("Insert messages failed:", msgErr.message);
    process.exit(1);
  }

  await verifySortOrder(supabase, dealershipId, newerConv.id, olderConv.id);
  await verifyAssignment(supabase, dealershipId, newerConv.id, staffUserId);

  console.log("");
  console.log("── Data created (disposable dev tenant) ──");
  console.log(`  Dealership id:   ${dealershipId}`);
  console.log(`  Slug:            ${slug}`);
  console.log(`  Staff Auth email:${email}`);
  console.log(`  Staff password:  (shown once) ${password}`);
  console.log(`  Staff user id:   ${staffUserId}`);
  console.log(`  Customer id:     ${customerId}`);
  console.log(`  Conv (newer):    ${newerConv.id}`);
  console.log(`  Conv (older):    ${olderConv.id}`);
  console.log("");
  console.log("Manual UI checks:");
  console.log(`  1. Sign in at /login as ${email} with the password above.`);
  console.log("  2. Open /inbox — [E2E] Newer thread should appear above [E2E] Older.");
  console.log("  3. Open the newer thread — messages, assignee, status should load.");
  console.log("");
  console.log("Remove this test data:");
  console.log("  DEV_INBOX_TEST_ALLOW=1 node scripts/dev-inbox-e2e-test.mjs --clean");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
