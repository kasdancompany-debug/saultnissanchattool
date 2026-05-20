/** Mirrors `DEALERSHIP_CHANNEL_PROVIDER` keys — kept client-safe for settings UI labels. */
const LABELS: Record<string, string> = {
  twilio_sms: "Twilio SMS",
  meta_messenger: "Meta · Messenger",
  meta_instagram: "Meta · Instagram",
  meta_whatsapp: "Meta · WhatsApp",
};

export function integrationProviderLabel(provider: string): string {
  return LABELS[provider] ?? provider;
}
