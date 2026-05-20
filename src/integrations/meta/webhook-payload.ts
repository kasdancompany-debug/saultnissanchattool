/**
 * Meta (Messenger / Instagram) webhooks — scaffold only.
 * When implemented: parse Graph payload → internal envelope; keep signature verification on the route.
 */

export type MetaWebhookPlaceholder = {
  readonly _kind: "meta.webhook.placeholder";
};

export function isMetaWebhookPlaceholder(
  value: unknown
): value is MetaWebhookPlaceholder {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as MetaWebhookPlaceholder)._kind === "meta.webhook.placeholder"
  );
}
