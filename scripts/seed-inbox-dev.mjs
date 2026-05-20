#!/usr/bin/env node
/**
 * Development seed: one customer, one conversation (optional second for list-sort demo),
 * and alternating customer/staff messages for inbox UI verification.
 *
 * Requirements (environment):
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL — project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role (bypasses RLS; never expose to browsers)
 *   SEED_STAFF_USER_ID — uuid of an existing staff_users row (your logged-in user id)
 *
 * Optional:
 *   SEED_DEMO_LIST_SORT=1 — also insert a second, older conversation (same customer)
 *     so the inbox list clearly orders by last_message_at (newest first).
 *
 * Usage:
 *   node scripts/seed-inbox-dev.mjs
 *   node scripts/seed-inbox-dev.mjs --clean   # remove rows tagged with this seed first
 *   node scripts/seed-inbox-dev.mjs --help
 *
 * Manual test data (Supabase SQL Editor or any Postgres client):
 *   1. Note your dealership_id and staff_users.id (staff id = auth user id).
 *   2. Insert into customers (dealership_id, display_name, phone_e164 optional, metadata).
 *   3. Insert into conversations (dealership_id, customer_id, channel, department, status,
 *      assigned_to_user_id, title, metadata).
 *   4. Insert into messages: customer rows use sender_type 'customer' and sender_user_id null;
 *      staff rows use sender_type 'staff' and sender_user_id = your staff uuid.
 *   5. last_message_at on conversations is updated automatically on message INSERT via trigger.
 *
 * Verification checklist:
 *   - Inbox list: row shows customer name, channel/dept badges, assignee, preview text,
 *     relative time from last_message_at / last activity.
 *   - With SEED_DEMO_LIST_SORT: newer conversation appears above the older one (same queue).
 *   - Open thread: messages ascending by time; customer bubbles vs staff; assignee in header.
 *   - "Mine" filter: shows seeded thread when assigned_to_user_id matches you.
 */

import { createClient } from "@supabase/supabase-js";
import process from "node:process";

const SEED_TAG = "inbox-dev-sample-v1";

function parseArgs(argv) {
  const clean = argv.includes("--clean");
  const help = argv.includes("--help") || argv.includes("-h");
  return { clean, help };
}

function printHelp() {
  console.log(`seed-inbox-dev.mjs

Environment:
  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SEED_STAFF_USER_ID          UUID of staff_users.id (must exist)

Optional:
  SEED_DEMO_LIST_SORT=1       Second older conversation for inbox list ordering

Flags:
  --clean   Delete previous rows tagged dev_seed=${SEED_TAG} for this dealership
  --help
`);
}

async function main() {
  const { clean, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    process.exit(0);
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const staffUserId = process.env.SEED_STAFF_USER_ID?.trim();
  const demoListSort =
    process.env.SEED_DEMO_LIST_SORT === "1" ||
    process.env.SEED_DEMO_LIST_SORT === "true";

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }
  if (!staffUserId) {
    console.error("Missing SEED_STAFF_USER_ID (uuid of your staff_users row).");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: staffRow, error: staffErr } = await supabase
    .from("staff_users")
    .select("id, dealership_id, display_name, email")
    .eq("id", staffUserId)
    .maybeSingle();

  if (staffErr) {
    console.error("staff_users lookup failed:", staffErr.message);
    process.exit(1);
  }
  if (!staffRow) {
    console.error(
      `No staff_users row for id ${staffUserId}. Sign up / sync staff first.`
    );
    process.exit(1);
  }

  const dealershipId = staffRow.dealership_id;
  const seedMeta = { dev_seed: SEED_TAG };

  if (clean) {
    const { data: convRows, error: convSelErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("dealership_id", dealershipId)
      .contains("metadata", seedMeta);

    if (convSelErr) {
      console.error("Could not list seeded conversations:", convSelErr.message);
      process.exit(1);
    }

    const convIds = (convRows ?? []).map((r) => r.id);
    if (convIds.length > 0) {
      const { error: delConvErr } = await supabase
        .from("conversations")
        .delete()
        .in("id", convIds);
      if (delConvErr) {
        console.error("Delete conversations failed:", delConvErr.message);
        process.exit(1);
      }
      console.log(`Removed ${convIds.length} seeded conversation(s).`);
    }

    const { data: custRows, error: custSelErr } = await supabase
      .from("customers")
      .select("id")
      .eq("dealership_id", dealershipId)
      .contains("metadata", seedMeta);

    if (custSelErr) {
      console.error("Could not list seeded customers:", custSelErr.message);
      process.exit(1);
    }

    const custIds = (custRows ?? []).map((r) => r.id);
    if (custIds.length > 0) {
      const { error: delCustErr } = await supabase
        .from("customers")
        .delete()
        .in("id", custIds);
      if (delCustErr) {
        console.error("Delete customers failed:", delCustErr.message);
        process.exit(1);
      }
      console.log(`Removed ${custIds.length} seeded customer(s).`);
    }
  }

  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();

  /** Staggered timestamps: oldest first so the bump trigger tracks the latest per conversation. */
  const t0 = now - 5 * 60_000;
  const t1 = now - 4 * 60_000;
  const t2 = now - 3 * 60_000;
  const t3 = now - 2 * 60_000;
  const t4 = now - 1 * 60_000;

  const { data: customer, error: custInsErr } = await supabase
    .from("customers")
    .insert({
      dealership_id: dealershipId,
      display_name: "Dev Customer (seed)",
      phone_e164: "+15559876543",
      email: "dev.customer.seed@example.com",
      metadata: seedMeta,
    })
    .select("id")
    .single();

  if (custInsErr) {
    console.error("Insert customer failed:", custInsErr.message);
    console.error(
      "If this is a duplicate email/phone for the dealership, run: node scripts/seed-inbox-dev.mjs --clean"
    );
    process.exit(1);
  }

  const customerId = customer.id;

  const conversationRows = [
    {
      dealership_id: dealershipId,
      customer_id: customerId,
      channel: "web_chat",
      department: "sales",
      status: "open",
      sentiment: "neutral",
      ai_enabled: false,
      assigned_to_user_id: staffUserId,
      title: "[DEV] Active conversation",
      metadata: seedMeta,
    },
  ];

  if (demoListSort) {
    conversationRows.push({
      dealership_id: dealershipId,
      customer_id: customerId,
      channel: "web_chat",
      department: "sales",
      status: "open",
      sentiment: "neutral",
      ai_enabled: false,
      assigned_to_user_id: staffUserId,
      title: "[DEV] Older thread (list sort)",
      metadata: { ...seedMeta, dev_seed_sort_demo: true },
    });
  }

  const { data: insertedConvs, error: convInsErr } = await supabase
    .from("conversations")
    .insert(conversationRows)
    .select("id, title");

  if (convInsErr) {
    console.error("Insert conversations failed:", convInsErr.message);
    process.exit(1);
  }

  const convList = insertedConvs ?? [];
  const mainConv = convList.find((c) => c.title?.includes("Active"));
  const olderConv = convList.find((c) => c.title?.includes("Older"));

  if (!mainConv) {
    console.error("Internal error: main conversation not found after insert.");
    process.exit(1);
  }

  const messagesMain = [
    {
      conversation_id: mainConv.id,
      sender_type: "customer",
      sender_user_id: null,
      body: "Hi — I'm looking at a used Rogue. Is it still available?",
      delivery_status: "delivered",
      raw_payload: {},
      metadata: {},
      created_at: iso(t0),
    },
    {
      conversation_id: mainConv.id,
      sender_type: "staff",
      sender_user_id: staffUserId,
      body: `Hi! Yes, we still have it on the lot. I can confirm details in a few minutes. — ${staffRow.display_name}`,
      delivery_status: "sent",
      raw_payload: {},
      metadata: {},
      created_at: iso(t1),
    },
    {
      conversation_id: mainConv.id,
      sender_type: "customer",
      sender_user_id: null,
      body: "Great. What's the mileage and Carfax status?",
      delivery_status: "delivered",
      raw_payload: {},
      metadata: {},
      created_at: iso(t2),
    },
    {
      conversation_id: mainConv.id,
      sender_type: "staff",
      sender_user_id: staffUserId,
      body: "78k km, one owner, clean Carfax — no accidents reported.",
      delivery_status: "sent",
      raw_payload: {},
      metadata: {},
      created_at: iso(t3),
    },
    {
      conversation_id: mainConv.id,
      sender_type: "customer",
      sender_user_id: null,
      body: "Perfect. Can I book a test drive for tomorrow morning?",
      delivery_status: "delivered",
      raw_payload: {},
      metadata: {},
      created_at: iso(t4),
    },
  ];

  const messagesOlder =
    demoListSort && olderConv
      ? [
          {
            conversation_id: olderConv.id,
            sender_type: "customer",
            sender_user_id: null,
            body: "Older thread: first message from two days ago.",
            delivery_status: "delivered",
            raw_payload: {},
            metadata: {},
            created_at: iso(now - 48 * 60 * 60_000),
          },
          {
            conversation_id: olderConv.id,
            sender_type: "staff",
            sender_user_id: staffUserId,
            body: "Thanks for reaching out — this thread is intentionally older for list sorting.",
            delivery_status: "sent",
            raw_payload: {},
            metadata: {},
            created_at: iso(now - 47 * 60 * 60_000),
          },
        ]
      : [];

  /** Insert oldest-first per conversation so last_message_at matches latest insert. */
  const allMessages = [...messagesOlder, ...messagesMain].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  const { error: msgErr } = await supabase.from("messages").insert(allMessages);

  if (msgErr) {
    console.error("Insert messages failed:", msgErr.message);
    process.exit(1);
  }

  console.log("Seed complete.");
  console.log(`  Dealership:     ${dealershipId}`);
  console.log(`  Customer:       ${customerId}`);
  console.log(`  Staff (assignee): ${staffUserId} (${staffRow.display_name})`);
  console.log(`  Main conversation: ${mainConv.id}`);
  if (olderConv) {
    console.log(`  Older conversation: ${olderConv.id} (list sort demo)`);
  }
  console.log("");
  console.log("Open /inbox and select the [DEV] Active conversation.");
  console.log("Verify: list preview + time, assignee name, thread order (customer/staff).");
  if (olderConv) {
    console.log(
      "With two threads: newer [DEV] Active should appear above [DEV] Older (last_message_at)."
    );
  } else {
    console.log(
      "Optional: SEED_DEMO_LIST_SORT=1 to add a second older row and verify list ordering."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
