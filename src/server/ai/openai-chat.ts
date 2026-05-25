import "server-only";

import { getInboundClassificationEnv } from "@/lib/env/inbound-classification-config";

export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Minimal OpenAI-compatible Chat Completions caller (`POST {OPENAI_BASE_URL}/chat/completions`; no SDK).
 */
export async function openaiChatCompletionsJson(
  params: {
    model: string;
    messages: ChatCompletionMessage[];
    temperature?: number;
  },
  signal?: AbortSignal
): Promise<{ content: string; raw: unknown }> {
  const env = getInboundClassificationEnv();
  const key = env.OPENAI_API_KEY;
  const url = `${env.OPENAI_BASE_URL}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.2,
      response_format: { type: "json_object" },
    }),
    signal,
  });

  const raw = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const errMsg =
      typeof raw.error === "object" &&
      raw.error !== null &&
      "message" in raw.error
        ? String((raw.error as { message?: string }).message)
        : res.statusText;
    throw new Error(`Chat Completions API error: ${errMsg}`);
  }

  const choice = Array.isArray(raw.choices)
    ? (raw.choices[0] as Record<string, unknown> | undefined)
    : undefined;
  const msg = choice?.message as Record<string, unknown> | undefined;
  const content = typeof msg?.content === "string" ? msg.content : "";
  if (!content.trim()) {
    throw new Error("Chat Completions API returned empty content");
  }

  return { content, raw };
}
