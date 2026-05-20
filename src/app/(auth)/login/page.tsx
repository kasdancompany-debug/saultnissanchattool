import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Suspense } from "react";

import { AuthCard, AuthCardFooter } from "@/components/auth/auth-card";
import { AuthCallout, AuthFormFallback } from "@/components/auth/auth-elements";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { AuthProductLockup } from "@/components/auth/auth-product-lockup";
import { LoginForm } from "@/components/auth/login-form";
import { SessionSignOut } from "@/components/auth/session-sign-out";
import { isSupabaseConfiguredAtRuntime } from "@/lib/env/public";
import { getSession } from "@/server/auth/staff";

export const metadata: Metadata = {
  title: "Sign in · Communications Console",
};

const errorMessages: Record<string, string> = {
  staff_required:
    "Your account signed in, but there is no staff profile linked yet. Ask an administrator to add you in staff_users, or sign out and use a different account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const errorKey = params.error;
  const errorMessage =
    errorKey && errorMessages[errorKey] ? errorMessages[errorKey] : null;
  const passwordResetSuccess = params.reset === "success";
  const supabaseReady = isSupabaseConfiguredAtRuntime();

  let showSessionSignOut = false;
  if (errorKey === "staff_required") {
    const { user } = await getSession();
    showSessionSignOut = Boolean(user);
  }

  return (
    <AuthCard>
      <AuthProductLockup />

      <AuthPageHeader
        eyebrow="Secure sign-in"
        title="Welcome back"
        description={
          <>
            <p>
              Use your dealership-issued email and password. You will land in the workspace with
              access scoped to your staff role.
            </p>
            <p className="text-muted-foreground/90 flex items-start gap-2 text-xs leading-relaxed">
              <ShieldCheck className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Protected by Supabase Auth and server-side staff checks — customer conversations
                never leave your dealership boundary.
              </span>
            </p>
          </>
        }
      />

      {!supabaseReady ? (
        <AuthCallout variant="error" role="alert" className="mb-7">
          Sign-in is not configured on this deployment yet. Add{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_APP_URL</code> in Vercel → Environment
          Variables, then redeploy.
        </AuthCallout>
      ) : null}

      {passwordResetSuccess || errorMessage ? (
        <div className="mb-7 space-y-4">
          {passwordResetSuccess ? (
            <AuthCallout variant="success" role="status" className="mb-0">
              Password updated. Sign in with your new password.
            </AuthCallout>
          ) : null}
          {errorMessage ? (
            <AuthCallout variant="error" role="alert" className="mb-0">
              {errorMessage}
            </AuthCallout>
          ) : null}
        </div>
      ) : null}

      <Suspense fallback={<AuthFormFallback />}>
        <LoginForm disabled={!supabaseReady} />
      </Suspense>

      {showSessionSignOut ? (
        <AuthCardFooter>
          <SessionSignOut />
        </AuthCardFooter>
      ) : null}
    </AuthCard>
  );
}
