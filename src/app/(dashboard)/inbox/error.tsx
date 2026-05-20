"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function InboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { surface: "inbox" } });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <div className="space-y-2">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Inbox could not be loaded
        </h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          {error.message || "An unexpected error occurred while loading conversations."}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
