"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  settingsInitialState,
  updateBusinessHoursAction,
  type SettingsActionState,
} from "@/app/(dashboard)/settings/actions";
import type {
  BusinessHoursConfigV1,
  WeekdayKey,
} from "@/lib/business-hours/types";
import { COMMON_TIMEZONES } from "@/lib/settings/common-timezones";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DAYS: { key: WeekdayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export function BusinessHoursForm({
  initial,
  canEdit,
}: {
  initial: BusinessHoursConfigV1;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    SettingsActionState,
    FormData
  >(updateBusinessHoursAction, settingsInitialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  const sched = initial.schedules.web_chat;

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

      <div className="grid gap-2 sm:max-w-md">
        <label className="text-foreground text-sm font-medium" htmlFor="bh-timezone">
          Timezone for hours
        </label>
        <Input
          id="bh-timezone"
          name="timezone"
          defaultValue={initial.timezone}
          required
          disabled={!canEdit || isPending}
          list="bh-tz-common"
        />
        <datalist id="bh-tz-common">
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs font-semibold">
              <th className="py-2 pr-4 font-medium">Day</th>
              <th className="py-2 pr-4 font-medium">Closed</th>
              <th className="py-2 pr-4 font-medium">Open</th>
              <th className="py-2 font-medium">Close</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map(({ key, label }) => {
              const window = sched[key];
              const closed = window === null;
              return (
                <tr key={key} className="border-border/80 border-b last:border-0">
                  <td className="text-foreground py-3 pr-4 font-medium">{label}</td>
                  <td className="py-3 pr-4">
                    <input
                      type="checkbox"
                      name={`wc_${key}_closed`}
                      defaultChecked={closed}
                      disabled={!canEdit || isPending}
                      className="border-input accent-primary size-4 rounded"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <Input
                      type="time"
                      name={`wc_${key}_open`}
                      defaultValue={window?.open ?? "09:00"}
                      disabled={!canEdit || isPending || closed}
                      className="w-[7rem]"
                    />
                  </td>
                  <td className="py-3">
                    <Input
                      type="time"
                      name={`wc_${key}_close`}
                      defaultValue={window?.close ?? "17:00"}
                      disabled={!canEdit || isPending || closed}
                      className="w-[7rem]"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
        Web chat availability is evaluated in this timezone. Overnight shifts (close
        after midnight) are not supported yet — split into two days if needed.
      </p>

      {canEdit ? (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save business hours"}
        </Button>
      ) : null}
    </form>
  );
}
