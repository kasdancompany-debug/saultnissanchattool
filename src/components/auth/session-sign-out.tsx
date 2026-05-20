"use client";

import { authAuxiliaryPanelClassName } from "@/components/auth/auth-card";
import { LogoutButton } from "@/components/auth/logout-button";

/**
 * Shown when the user has a Supabase session but cannot access the app (e.g. no staff_users row).
 */
export function SessionSignOut() {
  return (
    <div className={authAuxiliaryPanelClassName}>
      <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
        Signed in as the wrong user? Sign out and try another account.
      </p>
      <LogoutButton />
    </div>
  );
}
