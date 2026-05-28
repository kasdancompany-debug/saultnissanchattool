"use client";

import { useEffect, useMemo } from "react";

import type { StaffDepartment } from "@/integrations/supabase/database.types";
import {
  combineDateAndTimeToIso,
  splitIsoToDateAndTime,
} from "@/lib/appointments/format-datetime";
import type { AppointmentIntentInsight } from "@/lib/opportunity/detect-appointment-intent";
import type { AppointmentDepartment, AppointmentRow } from "@/lib/appointments/types";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type StaffOption = { id: string; display_name: string };

const selectClassName =
  "border-input bg-card h-8 w-full rounded-sm border px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/55";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-[11px] font-medium tracking-tight">
      {children}
    </span>
  );
}

function departmentFromConversation(
  department: StaffDepartment
): AppointmentDepartment {
  return department === "service" ? "service" : "sales";
}

function defaultDateTimeSeed(
  appointment: AppointmentRow | null,
  intentSeed: AppointmentIntentInsight | null | undefined
): { date: string; time: string } {
  const iso =
    appointment?.confirmed_datetime ??
    appointment?.proposed_datetime ??
    intentSeed?.proposedDatetimeIso ??
    new Date().toISOString();
  const split = splitIsoToDateAndTime(iso);
  if (split.date && split.time) {
    return split;
  }
  const now = splitIsoToDateAndTime(new Date().toISOString());
  return now;
}

export function ConfirmAppointmentModal({
  open,
  onOpenChange,
  conversationId,
  appointment,
  conversationDepartment,
  staffDirectory,
  currentStaffUserId,
  formAction,
  isPending,
  intentSeed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  appointment: AppointmentRow | null;
  conversationDepartment: StaffDepartment;
  staffDirectory: StaffOption[];
  currentStaffUserId: string;
  formAction: (payload: FormData) => void;
  isPending: boolean;
  intentSeed?: AppointmentIntentInsight | null;
}) {
  const defaults = useMemo(
    () => ({
      department:
        appointment?.department ??
        intentSeed?.department ??
        departmentFromConversation(conversationDepartment),
      dateTime: defaultDateTimeSeed(appointment, intentSeed),
      assignedUserId:
        appointment?.assigned_user_id?.trim() ||
        currentStaffUserId ||
        "",
      vehicleInterest: appointment?.vehicle_interest ?? "",
      notes: appointment?.notes ?? "",
    }),
    [appointment, conversationDepartment, currentStaffUserId, intentSeed]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isPending, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm appointment"
      description="Human-confirmed visit — saved to this thread, pipeline, and timeline."
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="conversationId" value={conversationId} />
        <input type="hidden" name="intent" value="appointment_confirm_save" />
        {appointment?.id ? (
          <input type="hidden" name="appointmentId" value={appointment.id} />
        ) : null}

        <div className="space-y-1.5">
          <FieldLabel>Department</FieldLabel>
          <select
            name="department"
            className={selectClassName}
            defaultValue={defaults.department}
            required
            disabled={isPending}
          >
            <option value="sales">Sales</option>
            <option value="service">Service</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <FieldLabel>Confirmed date</FieldLabel>
            <Input
              type="date"
              name="confirmedDate"
              required
              defaultValue={defaults.dateTime.date}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Confirmed time</FieldLabel>
            <Input
              type="time"
              name="confirmedTime"
              required
              defaultValue={defaults.dateTime.time}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Assign staff member</FieldLabel>
          <select
            name="assignedUserId"
            className={selectClassName}
            defaultValue={defaults.assignedUserId}
            disabled={isPending}
          >
            <option value="">Unassigned</option>
            {staffDirectory.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Vehicle / customer interest</FieldLabel>
          <Input
            name="vehicleInterest"
            placeholder="e.g. 2025 Rogue, oil change, trade-in"
            defaultValue={defaults.vehicleInterest}
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Notes</FieldLabel>
          <Textarea
            name="notes"
            rows={3}
            placeholder="Anything the team should know before the visit…"
            defaultValue={defaults.notes}
            disabled={isPending}
            className="text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-border/80 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Save confirmation"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Client-side validation helper for tests / optional pre-check. */
export function parseConfirmAppointmentFormDates(
  date: string,
  time: string
): string | null {
  return combineDateAndTimeToIso(date, time);
}
