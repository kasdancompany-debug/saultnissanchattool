"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

export function SubmitButton({
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...props}
      disabled={disabled ?? pending}
      aria-busy={pending}
      className={cn(
        "gap-1.5 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
        pending && "cursor-wait opacity-95",
        className
      )}
    >
      {pending ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : null}
      <span className="min-w-0">{children}</span>
    </Button>
  );
}
