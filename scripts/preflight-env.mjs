import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const APP_ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const checkTemplateOnly = args.has("--check-template");
const envPath = path.join(APP_ROOT, ".env.local");
const examplePath = path.join(APP_ROOT, ".env.example");

const requiredTemplateKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
];

function parseEnvFile(content) {
  const entries = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    entries.set(key, value);
  }
  return entries;
}

function printResult(ok, label, extra = "") {
  const status = ok ? "PASS" : "FAIL";
  const suffix = extra ? ` - ${extra}` : "";
  console.log(`[${status}] ${label}${suffix}`);
}

if (!existsSync(examplePath)) {
  printResult(false, ".env.example exists");
  process.exit(1);
}

const example = parseEnvFile(readFileSync(examplePath, "utf8"));
let failures = 0;

for (const key of requiredTemplateKeys) {
  const hasKey = example.has(key);
  printResult(hasKey, `template key: ${key}`);
  if (!hasKey) failures += 1;
}

if (checkTemplateOnly) {
  if (failures > 0) {
    console.error(`\nPreflight template check failed with ${failures} issue(s).`);
    process.exit(1);
  }
  console.log("\nPreflight template check passed.");
  process.exit(0);
}

if (!existsSync(envPath)) {
  printResult(false, ".env.local exists", "create from .env.example");
  process.exit(1);
}

const local = parseEnvFile(readFileSync(envPath, "utf8"));

function getLocal(key) {
  return (local.get(key) ?? process.env[key] ?? "").trim();
}

const requiredValueKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
];

for (const key of requiredValueKeys) {
  const value = getLocal(key);
  const ok = value.length > 0;
  printResult(ok, `required value: ${key}`);
  if (!ok) failures += 1;
}

const supabaseAnon = getLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const supabasePublishable = getLocal("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const hasSupabaseBrowserKey = Boolean(supabaseAnon || supabasePublishable);
printResult(
  hasSupabaseBrowserKey,
  "required value: NEXT_PUBLIC_SUPABASE_(ANON_KEY or PUBLISHABLE_KEY)"
);
if (!hasSupabaseBrowserKey) failures += 1;

const twilioPhone = getLocal("TWILIO_PHONE_NUMBER");
const e164 = /^\+[1-9]\d{6,14}$/;
const twilioPhoneOk = e164.test(twilioPhone);
printResult(
  twilioPhoneOk,
  "TWILIO_PHONE_NUMBER format",
  twilioPhoneOk ? "E.164 valid" : "must be +17055550100 style"
);
if (!twilioPhoneOk) failures += 1;

if (failures > 0) {
  console.error(`\nPreflight failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("\nPreflight passed. Environment looks ready for local development.");
