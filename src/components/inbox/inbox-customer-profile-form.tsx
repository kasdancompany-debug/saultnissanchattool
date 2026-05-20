"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { updateInboxCustomerProfileAction } from "@/app/(dashboard)/inbox/customer-actions";
import { markInboxClientRefreshed } from "@/lib/inbox-client-refresh-coord";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CustomerProfileState = {
  ok: boolean;
  error: string | null;
};

const initialState: CustomerProfileState = { ok: false, error: null };

export function InboxCustomerProfileForm({
  conversationId,
  displayName,
  email,
  phoneE164,
}: {
  conversationId: string;
  displayName: string | null;
  email: string | null;
  phoneE164: string | null;
}) {
  const router = useRouter();
  const [nameValue, setNameValue] = useState(displayName ?? "");
  const [phoneValue, setPhoneValue] = useState(phoneE164 ?? "");
  const [emailValue, setEmailValue] = useState(email ?? "");
  const [state, formAction, isPending] = useActionState<
    CustomerProfileState,
    FormData
  >(updateInboxCustomerProfileAction, initialState);

  useEffect(() => {
    setNameValue(displayName ?? "");
    setPhoneValue(phoneE164 ?? "");
    setEmailValue(email ?? "");
  }, [conversationId, displayName, phoneE164, email]);

  useEffect(() => {
    if (!state.ok) return;
    startTransition(() => {
      router.refresh();
      markInboxClientRefreshed();
    });
  }, [state.ok, router]);

  return (
    <form action={formAction} className="mt-2 grid gap-2 rounded-md border p-2.5">
      <input type="hidden" name="conversationId" value={conversationId} />
      <p className="text-[11px] font-medium">Customer profile</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          name="displayName"
          value={nameValue}
          onChange={(event) => setNameValue(event.target.value)}
          placeholder="Full name"
          maxLength={120}
          disabled={isPending}
        />
        <Input
          name="phoneE164"
          value={phoneValue}
          onChange={(event) => setPhoneValue(event.target.value)}
          placeholder="+17055550100"
          disabled={isPending}
        />
        <Input
          name="email"
          value={emailValue}
          onChange={(event) => setEmailValue(event.target.value)}
          placeholder="name@example.com"
          type="email"
          disabled={isPending}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[10px]">
          Clean up visitor details as you learn them.
        </p>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : "Save profile"}
        </Button>
      </div>
      {state.error ? (
        <p className="text-destructive text-[10px]" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
