"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  settingsInitialState,
  updateDealershipProfileAction,
  type SettingsActionState,
} from "@/app/(dashboard)/settings/actions";
import { COMMON_TIMEZONES } from "@/lib/settings/common-timezones";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DealershipProfileForm({
  initialName,
  initialSlug,
  initialTimezone,
  canEdit,
}: {
  initialName: string;
  initialSlug: string | null;
  initialTimezone: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    SettingsActionState,
    FormData
  >(updateDealershipProfileAction, settingsInitialState);

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

      <div className="grid gap-2 sm:max-w-md">
        <label className="text-foreground text-sm font-medium" htmlFor="name">
          Dealership name
        </label>
        <Input
          id="name"
          name="name"
          defaultValue={initialName}
          required
          disabled={!canEdit || isPending}
          autoComplete="organization"
        />
      </div>

      <div className="grid gap-2 sm:max-w-md">
        <label className="text-foreground text-sm font-medium" htmlFor="slug">
          URL slug
        </label>
        <Input
          id="slug"
          name="slug"
          defaultValue={initialSlug ?? ""}
          placeholder="sault-nissan"
          disabled={!canEdit || isPending}
          aria-describedby="slug-hint"
        />
        <p id="slug-hint" className="text-muted-foreground text-xs leading-relaxed">
          Lowercase letters, numbers, and hyphens. Used in embeds and public links.
        </p>
      </div>

      <div className="grid gap-2 sm:max-w-md">
        <label className="text-foreground text-sm font-medium" htmlFor="timezone">
          Default timezone
        </label>
        <Input
          id="timezone"
          name="timezone"
          defaultValue={initialTimezone}
          required
          disabled={!canEdit || isPending}
          list="tz-common"
        />
        <datalist id="tz-common">
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
        <p className="text-muted-foreground text-xs leading-relaxed">
          IANA timezone (e.g. America/Toronto). Business hours use the same region.
        </p>
      </div>

      {canEdit ? (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save profile"}
        </Button>
      ) : null}
    </form>
  );
}
