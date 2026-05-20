"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/integrations/supabase/browser";

import {
  AuthCallout,
  AuthField,
  AuthForm,
  AuthFormError,
  AuthPasswordFieldRow,
  AuthPrimaryLink,
  AuthSpinner,
  AuthSubmitButton,
  AuthTextLinkRow,
} from "@/components/auth/auth-elements";

const AUTH_FORM_ERROR_ID = "reset-password-form-error";

type Phase = "loading" | "form" | "invalid";

function hasRecoveryAuthParams(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const search = new URLSearchParams(window.location.search);
  if (search.has("code")) {
    return true;
  }
  const hash = window.location.hash.slice(1);
  if (!hash) {
    return false;
  }
  const params = new URLSearchParams(hash);
  return (
    params.has("access_token") ||
    params.get("type") === "recovery" ||
    hash.includes("type=recovery")
  );
}

function mapUpdatePasswordError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("same")) {
    return "Choose a password that is different from your current one.";
  }
  if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("least"))) {
    return "Your password does not meet the requirements. Use a longer or stronger password.";
  }
  if (m.includes("session") || m.includes("jwt")) {
    return "This link is no longer valid. Request a new reset email.";
  }
  return "We could not update your password. Try again or request a new reset link.";
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    const hasParams = hasRecoveryAuthParams();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) {
        return;
      }
      if (event === "PASSWORD_RECOVERY") {
        setPhase("form");
      }
    });

    if (!hasParams) {
      const t = window.setTimeout(() => {
        if (!cancelled) {
          setPhase("invalid");
        }
      }, 500);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
        subscription.unsubscribe();
      };
    }

    const failTimer = window.setTimeout(() => {
      if (!cancelled) {
        setPhase((p) => (p === "loading" ? "invalid" : p));
      }
    }, 15000);

    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError("Enter a new password.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match. Check both fields and try again.");
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(mapUpdatePasswordError(updateError.message));
        return;
      }

      await supabase.auth.signOut();
      router.replace("/login?reset=success");
    } catch {
      setError(mapUpdatePasswordError(""));
    } finally {
      setPending(false);
    }
  }

  if (phase === "loading") {
    return <AuthSpinner label="Verifying your reset link…" />;
  }

  if (phase === "invalid") {
    return (
      <div className="space-y-5">
        <AuthCallout variant="muted" role="alert" className="mb-0 text-center">
          <p className="text-foreground text-base font-semibold tracking-tight">Link unavailable</p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            This reset link is invalid or has expired. Request a new one and try again.
          </p>
        </AuthCallout>
        <AuthPrimaryLink href="/forgot-password">Send a new link</AuthPrimaryLink>
        <AuthTextLinkRow href="/login">Back to sign in</AuthTextLinkRow>
      </div>
    );
  }

  return (
    <AuthForm noValidate aria-busy={pending} onSubmit={(e) => void onSubmit(e)}>
      <AuthField label="New password" htmlFor="new-password">
        <AuthPasswordFieldRow
          inputId="new-password"
          name="password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? AUTH_FORM_ERROR_ID : undefined}
          autoComplete="new-password"
          disabled={pending}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          required
          showPassword={showPassword}
          onToggleShow={() => setShowPassword((v) => !v)}
          toggleLabelWhenHidden="Show new password"
          toggleLabelWhenVisible="Hide new password"
          value={password}
        />
      </AuthField>

      <AuthField
        label="Confirm password"
        htmlFor="confirm-password"
        hint="Use at least 8 characters. After updating, sign in with your new password."
      >
        <AuthPasswordFieldRow
          inputId="confirm-password"
          name="confirm"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? AUTH_FORM_ERROR_ID : undefined}
          autoComplete="new-password"
          disabled={pending}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError(null);
          }}
          required
          showPassword={showConfirm}
          onToggleShow={() => setShowConfirm((v) => !v)}
          toggleLabelWhenHidden="Show password confirmation"
          toggleLabelWhenVisible="Hide password confirmation"
          value={confirm}
        />
      </AuthField>

      {error ? <AuthFormError id={AUTH_FORM_ERROR_ID}>{error}</AuthFormError> : null}

      <AuthSubmitButton pending={pending} pendingLabel="Updating…" type="submit">
        Update password
      </AuthSubmitButton>

      <AuthTextLinkRow href="/login" disabled={pending}>
        Back to sign in
      </AuthTextLinkRow>
    </AuthForm>
  );
}
