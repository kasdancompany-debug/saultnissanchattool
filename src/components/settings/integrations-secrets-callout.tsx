export function IntegrationsSecretsCallout() {
  return (
    <div
      className="border-border bg-muted/25 rounded-xl border px-4 py-3 text-[12px] leading-relaxed"
      role="note"
    >
      <p className="text-foreground font-semibold">Secrets stay on the server</p>
      <p className="text-muted-foreground mt-1 text-[11px]">
        API keys, tokens, and app secrets are only in deployment environment variables. This page
        shows connection readiness and channel identifiers — never credentials.
      </p>
    </div>
  );
}
