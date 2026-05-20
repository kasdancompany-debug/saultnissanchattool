import "server-only";

export type MetaWebhookEnvelopeOk = {
  ok: true;
  /** Meta `object` field, e.g. `page` (Messenger), `instagram`. */
  object: string;
  entry: unknown[];
};

export type MetaWebhookEnvelopeErr = {
  ok: false;
  error: string;
};

export type MetaWebhookEnvelope = MetaWebhookEnvelopeOk | MetaWebhookEnvelopeErr;

/**
 * Minimal safe structural parse of a Meta webhook JSON body (no business rules).
 */
export function parseMetaWebhookEnvelope(parsed: unknown): MetaWebhookEnvelope {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "root_not_object" };
  }
  const root = parsed as Record<string, unknown>;
  const object = root.object;
  if (typeof object !== "string" || object.length === 0) {
    return { ok: false, error: "missing_or_invalid_object" };
  }
  const entry = root.entry;
  const entries = Array.isArray(entry) ? entry : [];
  return { ok: true, object, entry: entries };
}
