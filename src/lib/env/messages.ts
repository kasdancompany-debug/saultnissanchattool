import { ZodError } from "zod";

export function formatEnvValidationDetails(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

export function buildEnvConfigActionMessage(mode: "development" | "production"): string {
  return [
    `Invalid ${mode} environment configuration.`,
    "Fix the variables listed above and retry.",
    "See .env.example for the full contract.",
    "Twilio secrets must be server-only (never NEXT_PUBLIC_*).",
  ].join(" ");
}

export function buildTwilioMisconfiguredMessage(error: ZodError): string {
  const details = formatEnvValidationDetails(error);
  return [
    "Twilio environment is not configured correctly.",
    "Fix TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
    "See .env.example for expected values.",
    process.env.NODE_ENV === "development" ? `\n\nDetails:\n${details}` : "",
  ].join(" ");
}
