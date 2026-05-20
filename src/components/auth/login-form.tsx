"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/integrations/supabase/browser";
import {
  isValidEmailFormat,
  normalizeEmail,
} from "@/components/auth/auth-form-helpers";

import {
  AuthField,
  AuthForm,
  AuthFormError,
  AuthPasswordFieldRow,
  AuthSubmitButton,
  AuthTextLink,
  authInputClassName,
} from "@/components/auth/auth-elements";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const AUTH_FORM_ERROR_ID = "login-form-error";

function mapSignInError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("invalid login credentials") ||
    m.includes("invalid email or password") ||
    (m.includes("invalid") && m.includes("credential"))
  ) {
    return "That email or password does not match our records. You can try again or use “Forgot your password?” below.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email address before signing in, or ask an administrator for help.";
  }
  return message;
}

export function LoginForm({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") ?? "/overview";
  const redirectTo =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/overview";

  useEffect(() => {
    try {
      router.prefetch(redirectTo);
    } catch {
      /* ignore prefetch failures */
    }
  }, [router, redirectTo]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) {
      setError("Sign-in is not configured on this server yet.");
      return;
    }
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your work email.");
      return;
    }
    if (!isValidEmailFormat(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setPending(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const signInTimeoutMs = 45_000;
      const { error: signError } = await Promise.race([
        supabase.auth.signInWithPassword({
          email: normalizeEmail(trimmedEmail),
          password,
        }),
        new Promise<{ error: { message: string } }>((resolve) =>
          setTimeout(
            () =>
              resolve({
                error: {
                  message: `Sign-in timed out after ${signInTimeoutMs / 1000}s. Check your network or try again.`,
                },
              }),
            signInTimeoutMs
          )
        ),
      ]);

      if (signError) {
        setError(mapSignInError(signError.message));
        return;
      }

      const destination = redirectTo.startsWith("/") ? redirectTo : "/overview";
      // Do not call `router.refresh()` here — in dev it can wait on RSC and leave the UI stuck on "Signing in…".
      router.replace(destination);
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "Sign-in failed. Try again.";
      const isNetwork =
        raw === "Failed to fetch" ||
        raw === "NetworkError when attempting to fetch resource." ||
        (err instanceof TypeError && /fetch|network/i.test(raw));
      setError(
        isNetwork
          ? "We could not reach the sign-in service. Check your connection, try another browser, and ensure the app can reach Supabase."
          : raw
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthForm noValidate aria-busy={pending} onSubmit={onSubmit}>
      <AuthField label="Email" htmlFor="email">
        <Input
          autoComplete="email"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? AUTH_FORM_ERROR_ID : undefined}
          className={authInputClassName}
          disabled={pending || disabled}
          id="email"
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

      <AuthField label="Password" htmlFor="password">
        <AuthPasswordFieldRow
          inputId="password"
          name="password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? AUTH_FORM_ERROR_ID : undefined}
          autoComplete="current-password"
          disabled={pending || disabled}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          required
          showPassword={showPassword}
          onToggleShow={() => setShowPassword((v) => !v)}
          toggleLabelWhenHidden="Show password"
          toggleLabelWhenVisible="Hide password"
          value={password}
        />
        <div
          className={cn(
            "flex justify-end pt-0.5 transition-opacity duration-150",
            pending && "opacity-50"
          )}
          inert={pending ? true : undefined}
        >
          <AuthTextLink href="/forgot-password">Forgot your password?</AuthTextLink>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Use the credentials your administrator provided. Sessions stay scoped to your staff role.
        </p>
      </AuthField>

      {error ? <AuthFormError id={AUTH_FORM_ERROR_ID}>{error}</AuthFormError> : null}

      <AuthSubmitButton
        pending={pending}
        pendingLabel="Signing in…"
        type="submit"
        disabled={disabled}
      >
        Sign in to workspace
      </AuthSubmitButton>
    </AuthForm>
  );
}
