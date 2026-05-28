import { describe, expect, it } from "vitest";

import {
  buildServiceSchedulerMessageText,
  isServiceSchedulerConfigured,
  messageBodyIncludesSchedulerUrl,
  normalizeServiceSchedulerLabel,
  resolveServiceSchedulerPublicConfig,
} from "@/lib/service-scheduler/service-scheduler-message";

describe("service scheduler message", () => {
  it("defaults label to Book Service", () => {
    expect(normalizeServiceSchedulerLabel("")).toBe("Book Service");
    expect(normalizeServiceSchedulerLabel("  Schedule now  ")).toBe("Schedule now");
  });

  it("requires a valid http(s) URL", () => {
    expect(isServiceSchedulerConfigured("")).toBe(false);
    expect(isServiceSchedulerConfigured("not-a-url")).toBe(false);
    expect(isServiceSchedulerConfigured("https://dealer.example/service")).toBe(true);
  });

  it("builds outbound message text", () => {
    expect(
      buildServiceSchedulerMessageText("Book Service", "https://x.example/book")
    ).toBe("You can book service online here: Book Service — https://x.example/book");
  });

  it("resolves public config when URL is set", () => {
    const config = resolveServiceSchedulerPublicConfig({
      service_scheduler_url: "https://dealer.example/service",
      service_scheduler_label: "",
    });
    expect(config?.label).toBe("Book Service");
    expect(config?.messageText).toContain("https://dealer.example/service");
  });

  it("detects scheduler URL in message body", () => {
    const url = "https://dealer.example/service";
    const body = `Please use this link: ${url}`;
    expect(messageBodyIncludesSchedulerUrl(body, url)).toBe(true);
    expect(messageBodyIncludesSchedulerUrl(body, "https://other.example")).toBe(false);
  });
});
