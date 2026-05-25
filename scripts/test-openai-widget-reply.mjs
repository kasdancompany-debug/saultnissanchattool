import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const key = process.env.OPENAI_API_KEY?.trim();
const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const model = (process.env.AI_MODEL || "gpt-4o-mini").trim();

const customerMessage =
  "My name is Gary Indiana and my phone number is 705-206-3669";

const res = await fetch(`${base}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Sault Nissan website chat assistant. Reply in 1-3 short sentences.
- Reference the customer's exact words.
- If they already gave name and phone, thank them and ask about their service need — do NOT ask for name/phone again.
Return JSON only: {"reply":"<text>"}`,
      },
      {
        role: "user",
        content: `Latest customer message:\n"""\n${customerMessage}\n"""`,
      },
    ],
  }),
});

const raw = await res.json();
console.log("HTTP", res.status);
if (!res.ok) {
  console.log(JSON.stringify(raw, null, 2));
  process.exit(1);
}
const content = raw.choices?.[0]?.message?.content ?? "";
console.log("raw content:", content);
try {
  const parsed = JSON.parse(content);
  console.log("parsed reply:", parsed.reply);
} catch (e) {
  console.log("JSON parse failed:", e.message);
}
