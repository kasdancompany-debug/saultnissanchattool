"use client";

import { useMemo, useState } from "react";
import { Calendar, User } from "lucide-react";

import type { StaffDepartment } from "@/integrations/supabase/database.types";
import {
  formatAppointmentDisplay,
  notesPreview,
  toDatetimeLocalValue,
} from "@/lib/appointments/format-datetime";
import type { AppointmentReadiness } from "@/lib/opportunity/appointment-readiness";
import {
  APPOINTMENT_DEPARTMENT_LABEL,
  APPOINTMENT_STATUS_LABEL,
  isActiveAppointmentStatus,
  pickPrimaryAppointment,
  type AppointmentDepartment,
  type AppointmentRow,
} from "@/lib/appointments/types";
import type { InboxAppointmentRecord } from "@/types/inbox-appointment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppointmentCalendarExport } from "@/components/inbox/appointment-calendar-export";
import { cn } from "@/lib/utils";

type StaffOption = { id: string; display_name: string };

function statusBadgeClass(status: AppointmentRow["status"]): string {
  switch (status) {
    case "confirmed":
    case "completed":
      return "border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-50";
    case "proposed":
    case "awaiting_confirmation":
      return "border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50";
    case "no_show":
      return "border-rose-300/80 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-50";
    case "cancelled":
      return "border-slate-300/80 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200";
    default:
      return "";
  }
}

function departmentFromConversation(
  department: StaffDepartment
): AppointmentDepartment {
  return department === "service" ? "service" : "sales";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-[11px] font-medium tracking-tight">
      {children}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>{label}</FieldLabel>
      <span className="text-foreground text-[13px] leading-snug">{value}</span>
    </div>
  );
}

function HiddenFields({
  conversationId,
  appointmentId,
}: {
  conversationId: string;
  appointmentId?: string;
}) {
  return (
    <>
      <input type="hidden" name="conversationId" value={conversationId} />
      {appointmentId ? (
        <input type="hidden" name="appointmentId" value={appointmentId} />
      ) : null}
    </>
  );
}

const selectClassName =
  "border-input bg-card h-8 w-full rounded-sm border px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/55";

export function shouldShowInboxAppointmentCard(input: {
  appointments: InboxAppointmentRecord[];
  readiness: AppointmentReadiness;
}): boolean {
  if (input.appointments.length > 0) {
    return true;
  }
  return input.readiness.kind !== "none";
}

export function InboxAppointmentCard({
  conversationId,
  conversationDepartment,
  appointments,
  readiness,
  staffDirectory,
  formAction,
  isPending,
  hideConfirmButton = false,
  onRequestConfirm,
  customerName,
  customerEmail,
  customerPhoneE164,
}: {
  conversationId: string;
  conversationDepartment: StaffDepartment;
  appointments: InboxAppointmentRecord[];
  readiness: AppointmentReadiness;
  staffDirectory: StaffOption[];
  formAction: (payload: FormData) => void;
  isPending: boolean;
  hideConfirmButton?: boolean;
  onRequestConfirm?: () => void;
  customerName: string;
  customerEmail?: string | null;
  customerPhoneE164?: string | null;
}) {
  const primary = useMemo(
    () => pickPrimaryAppointment(appointments as AppointmentRow[]),
    [appointments]
  );

  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staffDirectory) {
      map.set(s.id, s.display_name);
    }
    return map;
  }, [staffDirectory]);

  const defaultDepartment =
    primary?.department ?? departmentFromConversation(conversationDepartment);

  const canOpenConfirmModal =
    (primary != null &&
      (primary.status === "proposed" ||
        primary.status === "awaiting_confirmation")) ||
    (primary == null && readiness.kind !== "none");
  const canComplete = primary?.status === "confirmed";
  const canNoShow = primary?.status === "confirmed";
  const canCancel =
    primary != null && isActiveAppointmentStatus(primary.status);
  const canEdit = primary != null && !editing;

  const cardTone =
    primary?.status === "confirmed" || primary?.status === "completed"
      ? "border-emerald-300/70 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30"
      : primary || readiness.kind === "proposed"
        ? "border-amber-300/70 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30"
        : readiness.kind === "interested"
          ? "border-blue-300/70 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/25"
          : "border-border/80 bg-muted/25";

  return (
    <div className={cn("space-y-3 rounded-md border px-3 py-3", cardTone)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Calendar className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <span className="text-foreground text-[13px] font-semibold tracking-tight">
            Appointment
          </span>
          {primary ? (
            <>
              <Badge variant="secondary" className="text-[11px] font-medium">
                {APPOINTMENT_DEPARTMENT_LABEL[primary.department]}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-[11px] font-semibold", statusBadgeClass(primary.status))}
              >
                {APPOINTMENT_STATUS_LABEL[primary.status]}
              </Badge>
            </>
          ) : (
            <Badge variant="outline" className="text-[11px] font-normal">
              {readiness.headline}
            </Badge>
          )}
        </div>
      </div>

      {!primary && !creating ? (
        <p className="text-muted-foreground text-[12px] leading-snug">{readiness.detail}</p>
      ) : null}

      {primary && !editing ? (
        <div className="space-y-2">
          <DetailRow
            label="Proposed"
            value={formatAppointmentDisplay(primary.proposed_datetime)}
          />
          <DetailRow
            label="Confirmed"
            value={formatAppointmentDisplay(primary.confirmed_datetime)}
          />
          <DetailRow
            label="Assigned"
            value={
              primary.assigned_user_id
                ? staffNameById.get(primary.assigned_user_id) ?? "Staff"
                : null
            }
          />
          {primary.assigned_user_id ? (
            <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <User className="size-3" aria-hidden />
              Owner for this visit
            </p>
          ) : null}
          <DetailRow
            label="Vehicle"
            value={primary.vehicle_interest?.trim() || null}
          />
          <DetailRow label="Notes" value={notesPreview(primary.notes)} />
          <AppointmentCalendarExport
            appointment={primary}
            customerName={customerName}
            customerEmail={customerEmail}
            customerPhoneE164={customerPhoneE164}
          />
        </div>
      ) : null}

      {editing && primary ? (
        <form action={formAction} className="space-y-2.5">
          <HiddenFields conversationId={conversationId} appointmentId={primary.id} />
          <input type="hidden" name="intent" value="appointment_edit" />
          <div className="grid gap-2">
            <div className="space-y-1">
              <FieldLabel>Department</FieldLabel>
              <select
                name="department"
                className={selectClassName}
                defaultValue={primary.department}
                disabled={isPending}
              >
                <option value="sales">Sales</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div className="space-y-1">
              <FieldLabel>Proposed time</FieldLabel>
              <Input
                type="datetime-local"
                name="proposedDatetime"
                defaultValue={toDatetimeLocalValue(primary.proposed_datetime)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Confirmed time</FieldLabel>
              <Input
                type="datetime-local"
                name="confirmedDatetime"
                defaultValue={toDatetimeLocalValue(primary.confirmed_datetime)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Assigned staff</FieldLabel>
              <select
                name="assignedUserId"
                className={selectClassName}
                defaultValue={primary.assigned_user_id ?? ""}
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
            <div className="space-y-1">
              <FieldLabel>Notes</FieldLabel>
              <Textarea
                name="notes"
                rows={2}
                defaultValue={primary.notes ?? ""}
                disabled={isPending}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending} className="h-8">
              {isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              disabled={isPending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {creating && !primary ? (
        <form action={formAction} className="space-y-2.5">
          <HiddenFields conversationId={conversationId} />
          <input type="hidden" name="intent" value="appointment_create" />
          <input
            type="hidden"
            name="source"
            value={readiness.kind !== "none" ? "ai_detected" : "manual"}
          />
          <div className="grid gap-2">
            <div className="space-y-1">
              <FieldLabel>Department</FieldLabel>
              <select
                name="department"
                className={selectClassName}
                defaultValue={defaultDepartment}
                disabled={isPending}
              >
                <option value="sales">Sales</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div className="space-y-1">
              <FieldLabel>Proposed time</FieldLabel>
              <Input
                type="datetime-local"
                name="proposedDatetime"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Notes</FieldLabel>
              <Textarea
                name="notes"
                rows={2}
                placeholder="Vehicle, service need, customer preference…"
                disabled={isPending}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending} className="h-8">
              {isPending ? "Creating…" : "Create appointment"}
            </Button>
            {appointments.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => setCreating(false)}
              >
                Back
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      {!editing && !creating ? (
        <div className="grid grid-cols-2 gap-1.5">
          {canOpenConfirmModal && !hideConfirmButton ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              className="col-span-2 h-8"
              disabled={isPending}
              onClick={() => onRequestConfirm?.()}
            >
              Confirm appointment
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={isPending}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          ) : null}
          {canComplete ? (
            <form action={formAction} className="min-w-0">
              <HiddenFields
                conversationId={conversationId}
                appointmentId={primary!.id}
              />
              <input type="hidden" name="intent" value="appointment_complete" />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-8 w-full"
                disabled={isPending}
              >
                Mark completed
              </Button>
            </form>
          ) : null}
          {canNoShow ? (
            <form action={formAction} className="min-w-0">
              <HiddenFields
                conversationId={conversationId}
                appointmentId={primary!.id}
              />
              <input type="hidden" name="intent" value="appointment_no_show" />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-8 w-full"
                disabled={isPending}
              >
                No show
              </Button>
            </form>
          ) : null}
          {canCancel ? (
            <form action={formAction} className={canEdit ? "min-w-0" : "col-span-2 min-w-0"}>
              <HiddenFields
                conversationId={conversationId}
                appointmentId={primary!.id}
              />
              <input type="hidden" name="intent" value="appointment_cancel" />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-8 w-full"
                disabled={isPending}
              >
                Cancel
              </Button>
            </form>
          ) : null}
          {!primary ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="col-span-2 h-8"
              disabled={isPending}
              onClick={() => setCreating(true)}
            >
              Add appointment
            </Button>
          ) : null}
        </div>
      ) : null}

      {appointments.length > 1 && primary ? (
        <p className="text-muted-foreground text-[11px] leading-snug">
          {appointments.length} appointment records on this thread — showing the latest active
          one.
        </p>
      ) : null}

    </div>
  );
}
