import type { Metadata } from "next";
import { Suspense } from "react";

import { InboxRouteSkeleton } from "@/components/inbox/inbox-route-skeleton";
import { InboxLoadError } from "@/components/inbox/inbox-load-error";
import { parseInboxFilter, parseInboxSort } from "@/components/inbox/inbox-params";

import { InboxAuthenticatedView } from "./inbox-authenticated-view";

export const metadata: Metadata = {
  title: "Inbox",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = {
  filter?: string;
  c?: string;
  owner?: string;
  sort?: string;
};

async function InboxPageContent({
  filter,
  sort,
  ownerParam,
  selectedConversationId,
}: {
  filter: ReturnType<typeof parseInboxFilter>;
  sort: ReturnType<typeof parseInboxSort>;
  ownerParam?: string;
  selectedConversationId: string | null;
}) {
  try {
    return (
      <InboxAuthenticatedView
        filter={filter}
        sort={sort}
        ownerParam={ownerParam}
        selectedConversationId={selectedConversationId}
      />
    );
  } catch (error) {
    console.error("[inbox] page render failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while loading the inbox.";
    const digest =
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: string }).digest === "string"
        ? (error as { digest: string }).digest
        : undefined;
    return <InboxLoadError message={message} digest={digest} />;
  }
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
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
      <InboxPageContent
        filter={filter}
        sort={sort}
        ownerParam={ownerParam}
        selectedConversationId={selectedConversationId}
      />
    </Suspense>
  );
}
