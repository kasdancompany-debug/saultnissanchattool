import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthOutlineLink } from "@/components/auth/auth-elements";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { SessionSignOut } from "@/components/auth/session-sign-out";
import { getSession } from "@/server/auth/staff";

export const metadata: Metadata = {
  title: "No staff access",
  description:
    "Your account is not linked to an active staff profile for this dealership.",
};

/**
 * Authenticated Supabase user without a matching active `staff_users` row.
 * No auto-provisioning — an admin must link auth.users.id in staff_users.
 */
export default async function UnauthorizedPage() {
  const { user } = await getSession();

  return (
    <AuthCard>
      <AuthPageHeader
        title="No staff profile linked"
        description={
          <>
            You are signed in, but this account is not linked to an{" "}
            <strong className="text-foreground/90 font-medium">active</strong> staff user for this
            dealership. A manager or admin must add your user ID to the{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">staff_users</code>{" "}
            table in Supabase, or you can sign out and use a different account.
          </>
        }
      />

      <ul className="text-muted-foreground mb-8 list-inside list-disc space-y-1.5 text-xs leading-relaxed sm:mb-9">
        <li>Confirm you are using the correct work email for this environment.</li>
        <li>If you were recently onboarded, ask an admin to verify your row is active.</li>
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
        <AuthOutlineLink href="/login">Back to sign in</AuthOutlineLink>
        {user ? (
          <div className="min-w-0 flex-1 sm:max-w-[220px]">
            <SessionSignOut />
          </div>
        ) : null}
      </div>
    </AuthCard>
  );
}
