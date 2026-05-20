"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  settingsInitialState,
  updateRoutingSettingsAction,
  type SettingsActionState,
} from "@/app/(dashboard)/settings/actions";
import {
  formatStaffDepartment,
  type RoutingSettingsV1,
} from "@/lib/settings/dealership-settings-v1";
import type { StaffDepartment } from "@/integrations/supabase/database.types";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DEPTS: StaffDepartment[] = [
  "sales",
  "service",
  "parts",
  "bdc",
  "management",
  "general",
];

export function RoutingSettingsForm({
  initial,
  canEdit,
}: {
  initial: RoutingSettingsV1;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    SettingsActionState,
    FormData
  >(updateRoutingSettingsAction, settingsInitialState);

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
        <label
          className="text-foreground text-sm font-medium"
          htmlFor="web_chat_default_department"
        >
          Default web chat queue
        </label>
        <select
          id="web_chat_default_department"
          name="web_chat_default_department"
          defaultValue={initial.web_chat_default_department}
          disabled={!canEdit || isPending}
          className="border-input bg-background text-foreground h-9 w-full rounded-lg border px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] duration-150 ease-out focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-0 motion-reduce:transition-none disabled:opacity-50"
        >
          {DEPTS.map((d) => (
            <option key={d} value={d}>
              {formatStaffDepartment(d)}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Used when routing rules need a default department (future automation).
        </p>
      </div>

      <div className="grid gap-2">
        <label
          className="text-foreground text-sm font-medium"
          htmlFor="intake_routing_notes"
        >
          Routing notes
        </label>
        <Textarea
          id="intake_routing_notes"
          name="intake_routing_notes"
          defaultValue={initial.intake_routing_notes ?? ""}
          rows={5}
          disabled={!canEdit || isPending}
          placeholder="e.g. Route sales leads to BDC after 5pm, Spanish-speaking requests to …"
          className="bg-muted/20 max-w-2xl resize-y"
        />
      </div>

      {canEdit ? (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save routing"}
        </Button>
      ) : null}
    </form>
  );
}
