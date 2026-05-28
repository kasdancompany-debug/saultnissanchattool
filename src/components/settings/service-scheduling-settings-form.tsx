"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  settingsInitialState,
  updateServiceSchedulingSettingsAction,
  type SettingsActionState,
} from "@/app/(dashboard)/settings/actions";
import { DEFAULT_SERVICE_SCHEDULER_LABEL } from "@/lib/service-scheduler/service-scheduler-message";
import type { ServiceSchedulingSettingsV1 } from "@/lib/settings/dealership-settings-v1";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ServiceSchedulingSettingsForm({
  initial,
  canEdit,
}: {
  initial: ServiceSchedulingSettingsV1;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    SettingsActionState,
    FormData
  >(updateServiceSchedulingSettingsAction, settingsInitialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-5">
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

      <div className="grid max-w-xl gap-4">
        <div className="grid gap-2">
          <label
            className="text-foreground text-sm font-medium"
            htmlFor="service_scheduler_url"
          >
            Service scheduler URL
          </label>
          <Input
            id="service_scheduler_url"
            name="service_scheduler_url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.exampledealer.com/service-appointment"
            defaultValue={initial.service_scheduler_url}
            disabled={!canEdit || isPending}
          />
          <p className="text-muted-foreground text-xs leading-relaxed">
            Outbound deep link only — staff can insert it in service conversations.
            No bay availability or DMS sync.
          </p>
        </div>

        <div className="grid gap-2 sm:max-w-md">
          <label
            className="text-foreground text-sm font-medium"
            htmlFor="service_scheduler_label"
          >
            Link label
          </label>
          <Input
            id="service_scheduler_label"
            name="service_scheduler_label"
            type="text"
            maxLength={80}
            placeholder={DEFAULT_SERVICE_SCHEDULER_LABEL}
            defaultValue={initial.service_scheduler_label}
            disabled={!canEdit || isPending}
          />
          <p className="text-muted-foreground text-xs leading-relaxed">
            Shown in the message staff send (defaults to {DEFAULT_SERVICE_SCHEDULER_LABEL}).
          </p>
        </div>
      </div>

      {canEdit ? (
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save service scheduling"}
        </Button>
      ) : null}
    </form>
  );
}
