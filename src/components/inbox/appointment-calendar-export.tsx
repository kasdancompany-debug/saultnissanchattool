"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Copy } from "lucide-react";

import {
  buildAppointmentCalendarSummary,
  buildAppointmentIcsContent,
  buildAppointmentIcsFilename,
  canExportAppointmentCalendar,
  type AppointmentCalendarExportContext,
} from "@/lib/appointments/calendar-export";
import type { AppointmentRow } from "@/lib/appointments/types";
import { getPublicAppOrigin } from "@/lib/app-url";
import { Button } from "@/components/ui/button";

export function AppointmentCalendarExport({
  appointment,
  customerName,
  customerEmail,
  customerPhoneE164,
}: {
  appointment: Pick<
    AppointmentRow,
    | "id"
    | "status"
    | "department"
    | "confirmed_datetime"
    | "vehicle_interest"
    | "notes"
    | "conversation_id"
  >;
  customerName: string;
  customerEmail?: string | null;
  customerPhoneE164?: string | null;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const exportContext = useMemo((): AppointmentCalendarExportContext | null => {
    if (!canExportAppointmentCalendar(appointment)) {
      return null;
    }
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : getPublicAppOrigin() || null;
    return {
      appointment,
      customerName,
      customerEmail,
      customerPhoneE164,
      appOrigin: origin,
    };
  }, [appointment, customerEmail, customerName, customerPhoneE164]);

  if (!exportContext) {
    return null;
  }

  const icsContent = buildAppointmentIcsContent(exportContext);
  const summary = buildAppointmentCalendarSummary(exportContext);

  if (!icsContent || !summary) {
    return null;
  }

  const filename = buildAppointmentIcsFilename(exportContext);

  const onDownload = () => {
    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const onCopySummary = async () => {
    setCopyState("idle");
    try {
      await navigator.clipboard.writeText(summary);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
    }
  };

  return (
    <div className="space-y-1.5 border-t border-border/60 pt-2.5">
      <p className="text-muted-foreground text-[11px] font-medium tracking-tight">
        Calendar
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 justify-start gap-1.5"
          onClick={onDownload}
        >
          <CalendarPlus className="size-3.5 shrink-0 opacity-70" aria-hidden />
          Download .ics
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 justify-start gap-1.5"
          onClick={() => void onCopySummary()}
        >
          <Copy className="size-3.5 shrink-0 opacity-70" aria-hidden />
          {copyState === "copied"
            ? "Copied"
            : copyState === "error"
              ? "Copy failed"
              : "Copy summary"}
        </Button>
      </div>
    </div>
  );
}
