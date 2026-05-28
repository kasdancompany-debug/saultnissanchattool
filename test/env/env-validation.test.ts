import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { getInboundClassificationEnv } from "@/lib/env/inbound-classification-config";
import { getTwilioServerEnv } from "@/lib/env/twilio-server";
import { validateStartupEnv } from "@/lib/env/startup";

const ORIGINAL_ENV = { ...process.env };

function setBaseValidDevEnv() {
  vi.stubEnv("NODE_ENV", "development");
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3042";
  process.env.TWILIO_ACCOUNT_SID = "AC1234567890";
  process.env.TWILIO_AUTH_TOKEN = "token-123";
  process.env.TWILIO_PHONE_NUMBER = "+17055550100";
  process.env.SKIP_ENV_VALIDATION = "0";
}

describe("environment validation", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };
    setBaseValidDevEnv();
  });

  it("passes startup validation in development with required keys", () => {
    expect(() => validateStartupEnv()).not.toThrow();
  });

  it("passes startup validation in development when Twilio keys are omitted", () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;

    expect(() => validateStartupEnv()).not.toThrow();
  });

  it("getTwilioServerEnv still fails when Twilio keys are missing", () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;

    expect(() => getTwilioServerEnv()).toThrowError(ZodError);
  });

  it("accepts Supabase publishable key when anon key is blank", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_123";

    expect(() => validateStartupEnv()).not.toThrow();
  });

  it("rejects invalid Twilio E.164 phone format", () => {
    process.env.TWILIO_PHONE_NUMBER = "705-555-0100";

    expect(() => getTwilioServerEnv()).toThrowError(ZodError);
  });

  it("defaults OPENAI_BASE_URL to official OpenAI v1 endpoint", () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    delete process.env.OPENAI_BASE_URL;

    const env = getInboundClassificationEnv();
    expect(env.OPENAI_BASE_URL).toBe("https://api.openai.com/v1");
  });

  it("inbound OpenAI env parses with only OPENAI (no Twilio) for widget AI", () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    delete process.env.TWILIO_ACCOUNT_SID;
    process.env.AI_MODEL = "gpt-4o-mini";
    const env = getInboundClassificationEnv();
    expect(env.OPENAI_API_KEY).toBe("sk-test-openai");
  });
});
