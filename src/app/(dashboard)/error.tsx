"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <div className="space-y-2">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Something went wrong
        </h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          {error.message ||
            "An unexpected error occurred in the workspace. The team has been notified."}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
