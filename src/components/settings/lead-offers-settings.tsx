"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteLeadOfferAction,
  saveLeadOfferAction,
  settingsInitialState,
  type SettingsActionState,
} from "@/app/(dashboard)/settings/actions";
import { formatStaffDepartment } from "@/lib/settings/dealership-settings-v1";
import { toDatetimeLocalInput } from "@/lib/lead-offers/form-datetime";
import type { LeadOfferRow } from "@/lib/lead-offers/types";
import type { StaffDepartment } from "@/integrations/supabase/database.types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const DEPTS: StaffDepartment[] = [
  "sales",
  "service",
  "parts",
  "bdc",
  "management",
  "general",
];

const emptyForm = {
  id: "",
  name: "",
  description: "",
  is_active: true,
  department: "general" as StaffDepartment,
  priority: 50,
  starts_at: "",
  ends_at: "",
  cta_text: "",
};

function offerToForm(o: LeadOfferRow) {
  return {
    id: o.id,
    name: o.name,
    description: o.description,
    is_active: o.is_active,
    department: o.department,
    priority: o.priority,
    starts_at: toDatetimeLocalInput(o.starts_at),
    ends_at: toDatetimeLocalInput(o.ends_at),
    cta_text: o.cta_text,
  };
}

export function LeadOffersSettings({
  offers,
  canEdit,
}: {
  offers: LeadOfferRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [saveState, saveAction, savePending] = useActionState<
    SettingsActionState,
    FormData
  >(saveLeadOfferAction, settingsInitialState);
  const [deleteState, deleteAction, deletePending] = useActionState<
    SettingsActionState,
    FormData
  >(deleteLeadOfferAction, settingsInitialState);

  useEffect(() => {
    if (saveState.ok || deleteState.ok) {
      router.refresh();
      if (saveState.ok) {
        setForm(emptyForm);
      }
    }
  }, [saveState.ok, deleteState.ok, router]);

  const editing = Boolean(form.id);

  return (
    <div className="space-y-8">
      <form action={saveAction} className="space-y-4">
        {form.id ? <input type="hidden" name="id" value={form.id} /> : null}
        {saveState.error ? (
          <p
            className="text-destructive bg-destructive/5 rounded-lg border border-destructive/20 px-3 py-2 text-sm"
            role="alert"
          >
            {saveState.error}
          </p>
        ) : null}
        {saveState.ok && saveState.message ? (
          <p className="text-foreground bg-muted/40 rounded-lg border px-3 py-2 text-sm">
            {saveState.message}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <label className="text-foreground text-sm font-medium" htmlFor="offer_name">
              Offer name
            </label>
            <Input
              id="offer_name"
              name="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={!canEdit || savePending}
              placeholder="Instant Trade Value"
              required
              maxLength={120}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <label className="text-foreground text-sm font-medium" htmlFor="offer_description">
              Description
            </label>
            <Textarea
              id="offer_description"
              name="description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              disabled={!canEdit || savePending}
              rows={3}
              placeholder="Brief context the AI can mention naturally — not a sales script."
              className="bg-muted/20 resize-y"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-foreground text-sm font-medium" htmlFor="offer_department">
              Department
            </label>
            <select
              id="offer_department"
              name="department"
              value={form.department}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  department: e.target.value as StaffDepartment,
                }))
              }
              disabled={!canEdit || savePending}
              className="border-input bg-background text-foreground h-9 w-full rounded-lg border px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/55 disabled:opacity-50"
            >
              {DEPTS.map((d) => (
                <option key={d} value={d}>
                  {formatStaffDepartment(d)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-foreground text-sm font-medium" htmlFor="offer_priority">
              Priority
            </label>
            <Input
              id="offer_priority"
              name="priority"
              type="number"
              min={0}
              max={1000}
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))
              }
              disabled={!canEdit || savePending}
            />
            <p className="text-muted-foreground text-xs">Higher runs first when multiple offers match.</p>
          </div>

          <div className="grid gap-2">
            <label className="text-foreground text-sm font-medium" htmlFor="offer_starts_at">
              Start date
            </label>
            <Input
              id="offer_starts_at"
              name="starts_at"
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              disabled={!canEdit || savePending}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-foreground text-sm font-medium" htmlFor="offer_ends_at">
              End date
            </label>
            <Input
              id="offer_ends_at"
              name="ends_at"
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
              disabled={!canEdit || savePending}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <label className="text-foreground text-sm font-medium" htmlFor="offer_cta_text">
              CTA text
            </label>
            <Input
              id="offer_cta_text"
              name="cta_text"
              value={form.cta_text}
              onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
              disabled={!canEdit || savePending}
              placeholder="Get a quick estimate"
              maxLength={120}
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="offer_is_active"
              name="is_active"
              type="checkbox"
              value="on"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              disabled={!canEdit || savePending}
              className="border-input size-4 rounded border"
            />
            <label className="text-foreground text-sm font-medium" htmlFor="offer_is_active">
              Active
            </label>
          </div>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={savePending}>
              {savePending ? "Saving…" : editing ? "Update offer" : "Create offer"}
            </Button>
            {editing ? (
              <Button
                type="button"
                variant="outline"
                disabled={savePending}
                onClick={() => setForm(emptyForm)}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        ) : null}
      </form>

      <div className="space-y-3">
        <h3 className="text-foreground text-sm font-semibold">Your offers</h3>
        {offers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No offers yet. Examples: Instant Trade Value, Get Pre-approved in 60 Seconds, Summer
            Tire Sale, Service Special, Book Appointment, Oil Change Promo.
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {offers.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-start justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground text-sm font-semibold">{o.name}</span>
                    <Badge variant={o.is_active ? "default" : "secondary"}>
                      {o.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatStaffDepartment(o.department)} · priority {o.priority}
                    </span>
                  </div>
                  {o.description ? (
                    <p className="text-muted-foreground text-xs leading-relaxed">{o.description}</p>
                  ) : null}
                  {o.cta_text ? (
                    <p className="text-muted-foreground text-[10px]">CTA: {o.cta_text}</p>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savePending || deletePending}
                      onClick={() => setForm(offerToForm(o))}
                    >
                      Edit
                    </Button>
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={deletePending}
                        className="text-destructive hover:text-destructive"
                      >
                        Delete
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
