"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function InboxErrorRetry({ label = "Try again" }: { label?: string }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-3"
      onClick={() => router.refresh()}
    >
      {label}
    </Button>
  );
}
