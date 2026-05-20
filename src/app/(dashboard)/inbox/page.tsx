import type { Metadata } from "next";
import { Suspense } from "react";

import { InboxRouteSkeleton } from "@/components/inbox/inbox-route-skeleton";
import { parseInboxFilter, parseInboxSort } from "@/components/inbox/inbox-params";

import { InboxAuthenticatedView } from "./inbox-authenticated-view";

export const metadata: Metadata = {
  title: "Inbox",
};

/** Operational queue: always fresh server data (auth + Supabase per request). */
export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; c?: string; owner?: string; sort?: string }>;
}) {
  const raw = await searchParams;
  const filter = parseInboxFilter(raw.filter);
  const sort = parseInboxSort(raw.sort);
  const c = typeof raw.c === "string" ? raw.c.trim() : "";
  const selectedConversationId = c.length > 0 ? c : null;
  const ownerParam = typeof raw.owner === "string" ? raw.owner : undefined;

  return (
    <Suspense
      fallback={<InboxRouteSkeleton showThread={Boolean(selectedConversationId)} />}
    >
      <InboxAuthenticatedView
        filter={filter}
        sort={sort}
        ownerParam={ownerParam}
        selectedConversationId={selectedConversationId}
      />
    </Suspense>
  );
}
