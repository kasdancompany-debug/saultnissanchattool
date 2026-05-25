#!/usr/bin/env node
/** Push widget API secrets to Vercel (required for conversations + AI from embed). */
import { execSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const project = process.argv[2] ?? "saultnissanchattool";
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

function stableSecret(projectName) {
  return createHash("sha256")
    .update(`widget-session:${projectName}:v1`)
    .digest("base64url");
}

const local = existsSync(envPath) ? parseEnvFile(envPath) : {};
const sessionSecret =
  local.WIDGET_SESSION_SECRET?.trim() ||
  stableSecret(project);
const apiKey = local.WIDGET_API_KEY?.trim() || "";

const vars = {
  WIDGET_SESSION_SECRET: sessionSecret,
};
if (apiKey.length >= 16) {
  vars.WIDGET_API_KEY = apiKey;
  vars.NEXT_PUBLIC_WIDGET_API_KEY = local.NEXT_PUBLIC_WIDGET_API_KEY?.trim() || apiKey;
}

const environments = ["production", "preview"];

execSync(`npx vercel link --project ${project} --yes`, { cwd: root, stdio: "inherit" });

for (const env of environments) {
  for (const [key, value] of Object.entries(vars)) {
    console.log(`+ ${key} (${env})`);
    execSync(
      `npx vercel env add ${key} ${env} --value ${JSON.stringify(value)} --yes --force`,
      { cwd: root, stdio: "inherit", maxBuffer: 10 * 1024 * 1024 }
    );
  }
}

console.log("Widget env push complete. Redeploy production for changes to apply.");
