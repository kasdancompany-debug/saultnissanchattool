"use client";

import { useEffect, useState } from "react";

import type { InboxConversationActionState } from "@/app/(dashboard)/inbox/conversation-action-states";
import { ConfirmAppointmentModal } from "@/components/inbox/confirm-appointment-modal";
import { InboxAppointmentCard } from "@/components/inbox/inbox-appointment-card";
import { InboxAppointmentIntentInsight } from "@/components/inbox/inbox-appointment-intent-insight";
import type { StaffDepartment } from "@/integrations/supabase/database.types";
import type { AppointmentReadiness } from "@/lib/opportunity/appointment-readiness";
import type { InboxAppointmentRecord } from "@/types/inbox-appointment";
import { pickPrimaryAppointment, type AppointmentRow } from "@/lib/appointments/types";

type StaffOption = { id: string; display_name: string };

export function shouldShowInboxAppointmentPanel(input: {
  appointments: InboxAppointmentRecord[];
  readiness: AppointmentReadiness;
}): boolean {
  if (input.appointments.length > 0) {
    return true;
  }
  if (input.readiness.intent?.show) {
    return true;
  }
  return input.readiness.kind !== "none";
}

export function InboxAppointmentPanel({
  conversationId,
  conversationDepartment,
  appointments,
  readiness,
  staffDirectory,
  currentStaffUserId,
  formAction,
  isPending,
  actionState,
  customerName,
  customerEmail,
  customerPhoneE164,
}: {
  conversationId: string;
  conversationDepartment: StaffDepartment;
  appointments: InboxAppointmentRecord[];
  readiness: AppointmentReadiness;
  staffDirectory: StaffOption[];
  currentStaffUserId: string;
  formAction: (payload: FormData) => void;
  isPending: boolean;
  actionState: InboxConversationActionState;
  customerName: string;
  customerEmail?: string | null;
  customerPhoneE164?: string | null;
}) {
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const primary = pickPrimaryAppointment(appointments as AppointmentRow[]);
  const showIntent =
    readiness.intent?.show === true && readiness.kind !== "booked";

  useEffect(() => {
    if (actionState.ok && confirmModalOpen) {
      setConfirmModalOpen(false);
    }
  }, [actionState.ok, confirmModalOpen]);

  return (
    <div className="space-y-3">
      {showIntent && readiness.intent ? (
        <InboxAppointmentIntentInsight
          intent={readiness.intent}
          onConfirmClick={() => setConfirmModalOpen(true)}
          isPending={isPending}
        />
      ) : null}

      <InboxAppointmentCard
        conversationId={conversationId}
        conversationDepartment={conversationDepartment}
        appointments={appointments}
        readiness={readiness}
        staffDirectory={staffDirectory}
        formAction={formAction}
        isPending={isPending}
        hideConfirmButton={showIntent}
        onRequestConfirm={() => setConfirmModalOpen(true)}
        customerName={customerName}
        customerEmail={customerEmail}
        customerPhoneE164={customerPhoneE164}
      />

      <ConfirmAppointmentModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        conversationId={conversationId}
        appointment={primary}
        conversationDepartment={conversationDepartment}
        staffDirectory={staffDirectory}
        currentStaffUserId={currentStaffUserId}
        formAction={formAction}
        isPending={isPending}
        intentSeed={readiness.intent}
      />
    </div>
  );
}
