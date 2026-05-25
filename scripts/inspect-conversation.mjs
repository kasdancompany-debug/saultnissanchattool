import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const convId = process.argv[2] || "0300f55d-6d5e-4107-b739-4f7cee4561cd";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: conv } = await supabase
  .from("conversations")
  .select("id, channel, status, ai_enabled, metadata")
  .eq("id", convId)
  .maybeSingle();

const { data: msgs } = await supabase
  .from("messages")
  .select("id, sender_type, body, created_at")
  .eq("conversation_id", convId)
  .order("created_at", { ascending: true });

console.log("conversation:", conv);
console.log("messages:", msgs);
