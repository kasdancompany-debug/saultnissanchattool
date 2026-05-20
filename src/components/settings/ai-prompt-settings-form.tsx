"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  settingsInitialState,
  updateAiPromptPlaceholdersAction,
  type SettingsActionState,
} from "@/app/(dashboard)/settings/actions";
import type { AiPromptPlaceholdersV1 } from "@/lib/settings/dealership-settings-v1";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AiPromptSettingsForm({
  initial,
  canEdit,
}: {
  initial: AiPromptPlaceholdersV1;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    SettingsActionState,
    FormData
  >(updateAiPromptPlaceholdersAction, settingsInitialState);

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

      <div className="grid gap-2">
        <label
          className="text-foreground text-sm font-medium"
          htmlFor="dealership_context"
        >
          Dealership context (placeholder)
        </label>
        <Textarea
          id="dealership_context"
          name="dealership_context"
          defaultValue={initial.dealership_context ?? ""}
          rows={8}
          disabled={!canEdit || isPending}
          placeholder="Policies, inventory focus, languages, hours summary — for future prompt injection."
          className="bg-muted/20 max-w-3xl resize-y text-[13px] leading-relaxed"
        />
      </div>

      <div className="grid gap-2">
        <label
          className="text-foreground text-sm font-medium"
          htmlFor="brand_voice_line"
        >
          Brand voice line
        </label>
        <Textarea
          id="brand_voice_line"
          name="brand_voice_line"
          defaultValue={initial.brand_voice_line ?? ""}
          rows={2}
          disabled={!canEdit || isPending}
          placeholder="Short line describing tone (e.g. friendly, professional, no pressure)."
          className="bg-muted/20 max-w-2xl resize-y"
        />
      </div>

      <p className="text-muted-foreground max-w-2xl text-xs leading-relaxed">
        These fields are stored securely and are not shown to customers. They will
        feed into AI prompts in a future release — not wired to production
        classification yet.
      </p>

      {canEdit ? (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save AI placeholders"}
        </Button>
      ) : null}
    </form>
  );
}
