"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { InboxThreadSkeleton } from "./inbox-thread-skeleton";

/** Conversation was removed or URL is stale — navigate back to the list without a server redirect. */
export function InboxThreadMissing({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return <InboxThreadSkeleton />;
}
