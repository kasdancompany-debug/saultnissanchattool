import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import type { FormHTMLAttributes, ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const authFocusRing = cn(
  "transition-[box-shadow,border-color,colors] duration-150",
  "focus-visible:border-ring/90 focus-visible:ring-[2.5px] focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
);

/** Standard auth text field (email, etc.). */
export const authInputClassName = cn(
  "h-11 px-3 text-[15px] sm:text-sm",
  "bg-background/80 dark:bg-input/40",
  authFocusRing
);

/** Password field with trailing visibility toggle. */
export const authPasswordInputClassName = cn(
  "h-11 pr-10 pl-3 text-[15px] sm:text-sm",
  "bg-background/80 dark:bg-input/40",
  authFocusRing
);

const passwordToggleButtonClassName = cn(
  "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  "absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg transition-colors",
  "focus-visible:outline-none focus-visible:ring-[2.5px] focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
);

export function AuthForm({
  children,
  className,
  ...formProps
}: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className={cn("space-y-6", className)} {...formProps}>
      {children}
    </form>
  );
}

export function AuthField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2.5">
      <label
        className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

export function AuthPasswordFieldRow({
  inputId,
  showPassword,
  onToggleShow,
  toggleLabelWhenHidden,
  toggleLabelWhenVisible,
  className,
  ...inputProps
}: Omit<React.ComponentProps<typeof Input>, "type" | "id" | "className"> & {
  inputId: string;
  showPassword: boolean;
  onToggleShow: () => void;
  toggleLabelWhenHidden: string;
  toggleLabelWhenVisible: string;
  className?: string;
}) {
  const toggleDisabled = Boolean(inputProps.disabled);
  return (
    <div className="relative">
      <Input
        id={inputId}
        type={showPassword ? "text" : "password"}
        className={cn(authPasswordInputClassName, className)}
        {...inputProps}
      />
      <button
        type="button"
        className={passwordToggleButtonClassName}
        aria-label={showPassword ? toggleLabelWhenVisible : toggleLabelWhenHidden}
        aria-pressed={showPassword}
        disabled={toggleDisabled}
        onClick={onToggleShow}
      >
        {showPassword ? (
          <EyeOff className="size-4 shrink-0" aria-hidden />
        ) : (
          <Eye className="size-4 shrink-0" aria-hidden />
        )}
      </button>
    </div>
  );
}

export type AuthCalloutVariant = "success" | "error" | "muted";

export function AuthCallout({
  variant,
  role,
  children,
  className,
}: {
  variant: AuthCalloutVariant;
  role?: "status" | "alert";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn(
        "mb-6 rounded-lg border px-3.5 py-3 text-sm leading-snug",
        variant === "success" &&
          "border-emerald-200/55 bg-emerald-50/40 text-emerald-950/95 dark:border-emerald-900/35 dark:bg-emerald-950/20 dark:text-emerald-50/95",
        variant === "error" &&
          "border-rose-200/60 bg-rose-50/45 text-rose-950/90 dark:border-rose-900/35 dark:bg-rose-950/25 dark:text-rose-50/95",
        variant === "muted" &&
          "border-border/70 bg-muted/25 text-foreground dark:bg-muted/20",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Inline validation / API messages — soft rose, not alarm red. */
export function AuthFormError({
  children,
  id,
}: {
  children: ReactNode;
  /** Optional id for `aria-describedby` on inputs. */
  id?: string;
}) {
  return (
    <p
      id={id}
      className="rounded-lg border border-rose-200/65 bg-rose-50/50 px-3.5 py-2.5 text-sm leading-snug text-rose-950/90 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-50/95"
      role="alert"
    >
      {children}
    </p>
  );
}

type AuthSubmitButtonProps = Omit<React.ComponentProps<typeof Button>, "children"> & {
  children: ReactNode;
  /** Shows spinner, disables button, sets `aria-busy`. */
  pending?: boolean;
  /** Label while pending (e.g. “Signing in…”). */
  pendingLabel?: string;
};

export function AuthSubmitButton({
  children,
  className,
  pending = false,
  pendingLabel,
  disabled,
  ...props
}: AuthSubmitButtonProps) {
  const isPending = Boolean(pending);
  const busyLabel = pendingLabel ?? "Working…";

  return (
    <Button
      {...props}
      className={cn(
        "h-12 min-h-12 w-full gap-2 rounded-md text-[15px] font-bold tracking-[-0.02em] shadow-[0_1px_0_0_rgba(0,0,0,0.14)] sm:text-base",
        "dark:shadow-[0_1px_0_0_rgba(0,0,0,0.35)]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isPending && "cursor-wait opacity-95",
        className
      )}
      size="lg"
      disabled={Boolean(disabled || isPending)}
      aria-busy={isPending}
    >
      {isPending ? (
        <>
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          <span>{busyLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function AuthPrimaryLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "default", size: "lg" }),
        "h-12 min-h-12 w-full rounded-md text-[15px] font-bold tracking-[-0.02em] shadow-[0_1px_0_0_rgba(0,0,0,0.14)] dark:shadow-[0_1px_0_0_rgba(0,0,0,0.35)]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function AuthTextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-primary text-sm font-medium underline-offset-4 hover:underline",
        "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function AuthTextLinkRow({
  href,
  children,
  className,
  disabled = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <p
      className={cn("text-center transition-opacity duration-150", disabled && "opacity-50", className)}
      inert={disabled ? true : undefined}
    >
      <AuthTextLink href={href}>{children}</AuthTextLink>
    </p>
  );
}

export function AuthOutlineLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline", size: "lg" }),
        "h-11 w-full justify-center sm:h-10 sm:w-auto",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function AuthFormFallback() {
  return (
    <div className="text-muted-foreground animate-pulse py-8 text-sm font-medium">Loading…</div>
  );
}

export function AuthSpinner({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 py-6 text-sm">
      <div
        className="border-muted border-t-primary size-8 animate-spin rounded-full border-2"
        aria-hidden
      />
      <p>{label}</p>
    </div>
  );
}
