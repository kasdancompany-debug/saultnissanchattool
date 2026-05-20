import { InboxRouteSkeleton } from "@/components/inbox/inbox-route-skeleton";

/** Inbox segment: full chrome + list + thread placeholders (thread column safe for deep links). */
export default function InboxLoading() {
  return <InboxRouteSkeleton showThread />;
}
