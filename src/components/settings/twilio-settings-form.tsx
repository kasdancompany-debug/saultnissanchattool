"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  settingsInitialState,
  updateTwilioPublicSettingsAction,
  type SettingsActionState,
} from "@/app/(dashboard)/settings/actions";
import type { TwilioPlaceholdersV1 } from "@/lib/settings/dealership-settings-v1";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function TwilioSettingsForm({
  initialPhoneE164,
  initialTwilioMeta,
  canEdit,
}: {
  initialPhoneE164: string | null;
  initialTwilioMeta: TwilioPlaceholdersV1;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    SettingsActionState,
    FormData
  >(updateTwilioPublicSettingsAction, settingsInitialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <p
          className="text-destructive bg-destructive/5 rounded-lg border border-destructive/20 px-3 py-2 text-sm"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="text-foreground bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}

      <div
        className="border-border bg-muted/30 rounded-xl border px-4 py-3 text-sm leading-relaxed"
        role="note"
      >
        <p className="text-foreground font-medium">Secrets stay on the server</p>
        <p className="text-muted-foreground mt-1 text-[13px]">
          Twilio Account SID, Auth Token, and API keys are configured only in
          deployment environment variables. They are never stored in the database
          or sent to the browser.
        </p>
      </div>

      <div className="grid gap-2 sm:max-w-md">
        <label
          className="text-foreground text-sm font-medium"
          htmlFor="twilio_phone_e164"
        >
          Inbound SMS number (E.164)
        </label>
        <Input
          id="twilio_phone_e164"
          name="twilio_phone_e164"
          defaultValue={initialPhoneE164 ?? ""}
          placeholder="+17055550100"
          disabled={!canEdit || isPending}
          autoComplete="tel"
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Public number on file for this dealership. Must match Twilio configuration.
        </p>
      </div>

      <div className="grid gap-2">
        <label
          className="text-foreground text-sm font-medium"
          htmlFor="integration_notes"
        >
          Integration notes (placeholder)
        </label>
        <Textarea
          id="integration_notes"
          name="integration_notes"
          defaultValue={initialTwilioMeta.integration_notes ?? ""}
          rows={4}
          disabled={!canEdit || isPending}
          placeholder="e.g. status callback URL pattern, subaccount, go-live date."
          className="bg-muted/20 max-w-2xl resize-y"
        />
      </div>

      {canEdit ? (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save Twilio settings"}
        </Button>
      ) : null}
    </form>
  );
}
