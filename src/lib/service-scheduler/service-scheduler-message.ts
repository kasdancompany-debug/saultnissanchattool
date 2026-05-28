export const DEFAULT_SERVICE_SCHEDULER_LABEL = "Book Service";

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function normalizeServiceSchedulerLabel(label: string | undefined): string {
  const trimmed = label?.trim();
  return trimmed || DEFAULT_SERVICE_SCHEDULER_LABEL;
}

export function isServiceSchedulerConfigured(url: string | undefined | null): boolean {
  const trimmed = url?.trim() ?? "";
  return trimmed.length > 0 && isValidHttpUrl(trimmed);
}

export function buildServiceSchedulerMessageText(label: string, url: string): string {
  return `You can book service online here: ${label} — ${url}`;
}

export function messageBodyIncludesSchedulerUrl(body: string, url: string): boolean {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    return false;
  }
  return body.includes(normalizedUrl);
}

export type ServiceSchedulerPublicConfig = {
  url: string;
  label: string;
  messageText: string;
};

export function resolveServiceSchedulerPublicConfig(input: {
  service_scheduler_url?: string;
  service_scheduler_label?: string;
}): ServiceSchedulerPublicConfig | null {
  const url = input.service_scheduler_url?.trim() ?? "";
  if (!isServiceSchedulerConfigured(url)) {
    return null;
  }
  const label = normalizeServiceSchedulerLabel(input.service_scheduler_label);
  return {
    url,
    label,
    messageText: buildServiceSchedulerMessageText(label, url),
  };
}
