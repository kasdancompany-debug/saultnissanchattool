/**
 * End-to-end widget AI test against production (or WIDGET_TEST_ORIGIN).
 * Usage: node scripts/test-widget-ai-prod.mjs
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const ORIGIN =
  process.env.WIDGET_TEST_ORIGIN?.trim() ||
  "https://saultnissanchattool.vercel.app";
const API_KEY = process.env.WIDGET_API_KEY?.trim() || "";
const SLUG = process.env.NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG?.trim() || "sault-nissan";

function headers(sessionToken) {
  const h = { "Content-Type": "application/json" };
  if (API_KEY) h["X-Widget-Key"] = API_KEY;
  if (sessionToken) h.Authorization = `Bearer ${sessionToken}`;
  return h;
}

async function json(url, init) {
  const res = await fetch(url, init);
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function main() {
  console.log("Origin:", ORIGIN);
  console.log("API key set:", Boolean(API_KEY));

  const start = await json(`${ORIGIN}/api/widget/conversations`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      dealership_slug: SLUG,
      page_path: "/widget-test",
      widget_intent: "service",
    }),
  });
  console.log("\n[1] POST /conversations", start.status, JSON.stringify(start.body, null, 2));
  if (start.status !== 200 || !start.body?.conversation_id) {
    process.exit(1);
  }

  const { conversation_id, session_token } = start.body;
  const msgText =
    process.env.WIDGET_TEST_MESSAGE?.trim() ||
    `Widget AI probe ${Date.now()}`;
  const t0 = Date.now();
  const post = await json(
    `${ORIGIN}/api/widget/conversations/${conversation_id}/messages`,
    {
      method: "POST",
      headers: headers(session_token),
      body: JSON.stringify({ text: msgText }),
    }
  );
  const elapsed = Date.now() - t0;
  console.log(
    `\n[2] POST /messages (${elapsed}ms)`,
    post.status,
    JSON.stringify(post.body, null, 2)
  );

  if (post.body?.assistant_message) {
    console.log("\nOK: assistant_message in POST response");
    return;
  }

  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await json(
      `${ORIGIN}/api/widget/conversations/${conversation_id}/messages`,
      { method: "GET", headers: headers(session_token) }
    );
    const msgs = poll.body?.messages ?? [];
    const aiAfter = msgs.filter(
      (m, idx) =>
        m.sender === "ai" &&
        msgs.findIndex((x) => x.body === msgText && x.sender === "customer") <
          idx
    );
    console.log(`\n[3] GET poll #${i + 1}`, poll.status, "messages:", msgs.length, "ai after:", aiAfter.length);
    if (aiAfter.length > 0) {
      console.log("OK: AI reply via poll:", aiAfter[0].body?.slice(0, 120));
      return;
    }
  }

  console.error("\nFAIL: No assistant reply after POST or 15s polling");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
