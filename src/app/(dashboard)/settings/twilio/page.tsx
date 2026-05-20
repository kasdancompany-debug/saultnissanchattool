import { redirect } from "next/navigation";

/** @deprecated Use `/settings/integrations/twilio`. */
export default function SettingsTwilioRedirectPage() {
  redirect("/settings/integrations/twilio");
}
