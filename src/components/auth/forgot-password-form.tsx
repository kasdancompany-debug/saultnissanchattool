"use client";

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/integrations/supabase/browser";
import { getAuthResetPasswordUrl, getPublicAppOrigin } from "@/lib/app-url";
import {
  isValidEmailFormat,
  normalizeEmail,
} from "@/components/auth/auth-form-helpers";

import {
  AuthCallout,
  AuthField,
  AuthForm,
  AuthFormError,
  AuthPrimaryLink,
  AuthSubmitButton,
  AuthTextLinkRow,
  authInputClassName,
} from "@/components/auth/auth-elements";
import { Input } from "@/components/ui/input";

const AUTH_FORM_ERROR_ID = "forgot-password-form-error";

function mapResetRequestError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate") || m.includes("too many")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "Enter a valid email address.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "We could not reach the server. Check your connection and try again.";
  }
  return "We could not send the reset email. Please try again in a moment.";
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your work email.");
      return;
    }
    if (!isValidEmailFormat(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setPending(true);

    try {
      const origin = getPublicAppOrigin();
      if (!origin) {
        setError("This app is missing NEXT_PUBLIC_APP_URL. Contact your administrator.");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const redirectTo = getAuthResetPasswordUrl();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizeEmail(trimmed),
        { redirectTo }
      );

      if (resetError) {
        setError(mapResetRequestError(resetError.message));
        return;
      }

      setSuccess(true);
    } catch {
      setError(mapResetRequestError(""));
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <AuthCallout variant="muted" role="status" className="mb-0 text-center">
          <p className="text-foreground text-base font-semibold tracking-tight">Check your email</p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            If an account exists for{" "}
            <span className="text-foreground font-medium">{normalizeEmail(email)}</span>, we
            sent a link to reset your password. It may take a minute to arrive.
          </p>
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Did not get an email? Check spam, confirm the address is correct, then try again.
          </p>
        </AuthCallout>
        <AuthPrimaryLink href="/login">Back to sign in</AuthPrimaryLink>
      </div>
    );
  }

  return (
    <AuthForm noValidate aria-busy={pending} onSubmit={(e) => void onSubmit(e)}>
      <AuthField
        label="Email"
        htmlFor="forgot-email"
        hint="We will email you a secure link to choose a new password."
      >
        <Input
          autoComplete="email"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? AUTH_FORM_ERROR_ID : undefined}
          className={authInputClassName}
          disabled={pending}
          id="forgot-email"
          name="email"
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="you@dealership.com"
          required
          type="email"
          value={email}
        />
      </AuthField>

      {error ? <AuthFormError id={AUTH_FORM_ERROR_ID}>{error}</AuthFormError> : null}

      <AuthSubmitButton pending={pending} pendingLabel="Sending link…" type="submit">
        Send reset link
      </AuthSubmitButton>

      <AuthTextLinkRow href="/login" disabled={pending}>
        Back to sign in
      </AuthTextLinkRow>
    </AuthForm>
  );
}
