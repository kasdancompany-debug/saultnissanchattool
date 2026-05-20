import type { ComponentType } from "react";
import Link from "next/link";
import {
  Inbox,
  List,
  MessageCircle,
  Route,
  Sparkles,
  UserRound,
} from "lucide-react";

import type { InboxSort } from "@/lib/inbox/inbox-sort";
import type {
  InboxConversationListItem,
  InboxFilter,
} from "@/server/data/inbox";

import { buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cardElevationClassName } from "@/lib/ui/panel";
import { cn } from "@/lib/utils";

import { buildInboxHref } from "./inbox-params";
import { ConversationListRow } from "./conversation-list-row";
import { InboxSortSelect } from "./inbox-sort-select";

type OnboardingIcon = ComponentType<{ className?: string }>;

type EmptyOnboarding = {
  /** One line under “Conversations” when this view has zero rows */
  listHint: string;
  eyebrow: string;
  title: string;
  lede: string;
  steps: readonly [string, string, string];
  primary: { href: string; label: string; Icon: OnboardingIcon };
  secondary?: { href: string; label: string; Icon: OnboardingIcon };
  footnote?: string;
};

const ALL_OPEN_ONBOARDING = (widgetHref: string): EmptyOnboarding => ({
  listHint: "Run a quick test below — your first thread should appear here in under a minute.",
  eyebrow: "Get started",
  title: "Bring your first conversation into the inbox",
  lede:
    "This inbox is your omnichannel hub: SMS, website chat, Messenger, Instagram, and WhatsApp threads all land in one queue so your team can triage, assign, and reply without switching tools.",
  steps: [
    "Open the test widget and send yourself a message — it behaves like a real customer on web chat.",
    "Come back to this inbox: the thread appears under All Open, sorted by latest activity, with its channel on the row.",
    "Click the row to open it, assign an owner if needed, and send your first reply — delivery follows each thread’s channel.",
  ],
  primary: {
    href: widgetHref,
    label: "Send a test message",
    Icon: MessageCircle,
  },
  secondary: {
    href: "/settings/routing",
    label: "Set up web chat & routing",
    Icon: Route,
  },
  footnote:
    "Connect Twilio for SMS and Meta for Messenger / Instagram / WhatsApp — each thread is labeled so you always know where the customer reached you.",
});

function emptyOnboarding(filter: InboxFilter, widgetHref: string): EmptyOnboarding {
  switch (filter) {
    case "all_open":
      return ALL_OPEN_ONBOARDING(widgetHref);
    case "mine":
      return {
        listHint: "Claim work from shared queues or send yourself a test thread.",
        eyebrow: "Your queue",
        title: "You do not own any customers yet",
        lede:
          "Customer threads appear here once they are assigned to you. Claim from Unassigned or take over from another teammate when handoffs happen.",
        steps: [
          "Open Unassigned and take ownership of anything waiting for a teammate.",
          "Switch to All Open to scan the full pipeline and jump into high-priority threads.",
          "Use the test widget if you want a safe demo thread to practice on.",
        ],
        primary: {
          href: buildInboxHref("unassigned"),
          label: "Open Unassigned",
          Icon: UserRound,
        },
        secondary: {
          href: widgetHref,
          label: "Send a test message",
          Icon: MessageCircle,
        },
        footnote: "Still quiet? Ask an admin to review routing under Settings → Routing.",
      };
    case "unassigned":
      return {
        listHint: "New threads often land here first until someone claims customer ownership.",
        eyebrow: "Triage",
        title: "No unassigned conversations right now",
        lede:
          "Every open thread currently has an owner. When volume picks up, new SMS, web chat, and social DMs often appear here first so triage stays predictable.",
        steps: [
          "Keep this view open when you’re covering intake — new items surface at the top.",
          "Click a conversation to read context, then reply or assign it to Sales, Service, or a teammate.",
          "Use All Open anytime to see the full dealership queue in one list.",
        ],
        primary: {
          href: buildInboxHref("all_open"),
          label: "View all open threads",
          Icon: List,
        },
        secondary: {
          href: widgetHref,
          label: "Try the test widget",
          Icon: MessageCircle,
        },
      };
    case "sales":
      return {
        listHint: "Nothing in this view is tagged for Sales in the open queue.",
        eyebrow: "Sales queue",
        title: "No Sales-queue threads yet",
        lede:
          "Routing sends eligible chats here for your Sales team. If it’s quiet, the rest of the pipeline is still under All Open.",
        steps: [
          "Browse All Open to catch anything that still needs a Sales touch.",
          "Open a thread and use your normal workflow — department labels follow routing rules.",
          "Adjust how chats are steered under Settings → Routing when your process changes.",
        ],
        primary: {
          href: buildInboxHref("all_open"),
          label: "Browse All Open",
          Icon: List,
        },
        secondary: {
          href: "/settings/routing",
          label: "Review routing rules",
          Icon: Route,
        },
      };
    case "service":
      return {
        listHint: "Nothing in this view is tagged for Service in the open queue.",
        eyebrow: "Service queue",
        title: "No Service-queue threads yet",
        lede:
          "Routing sends eligible chats here for Service. If it’s quiet, you can still work the full open queue.",
        steps: [
          "Check All Open for active customers who may need Service follow-up.",
          "Claim or assign threads so the right bay or advisor gets the context.",
          "Tune routing in Settings when your service lanes or coverage change.",
        ],
        primary: {
          href: buildInboxHref("all_open"),
          label: "Browse All Open",
          Icon: List,
        },
        secondary: {
          href: "/settings/routing",
          label: "Review routing rules",
          Icon: Route,
        },
      };
    case "closed":
      return {
        listHint: "Resolved and archived threads collect here over time.",
        eyebrow: "History",
        title: "No closed conversations yet",
        lede:
          "Once your team resolves or archives threads, they show up here for audits, callbacks, and handoffs — so nothing disappears into a personal inbox.",
        steps: [
          "Go to All Open to work active customer conversations.",
          "When a thread is finished, use Delete conversation in the thread view — it will land here automatically.",
          "Need a sample? Send a test from the widget, reply once, then delete the conversation to see the flow.",
        ],
        primary: {
          href: buildInboxHref("all_open"),
          label: "Go to open queue",
          Icon: Inbox,
        },
        secondary: {
          href: widgetHref,
          label: "Send a test message",
          Icon: MessageCircle,
        },
      };
    default: {
      const _exhaustive: never = filter;
      void _exhaustive;
      return ALL_OPEN_ONBOARDING(widgetHref);
    }
  }
}

export function ConversationListPanel({
  items,
  filter,
  sort,
  assigneeScopeUserId,
  selectedConversationId,
  currentStaffUserId,
  widgetHref,
  emptyHint,
}: {
  items: InboxConversationListItem[];
  filter: InboxFilter;
  sort: InboxSort;
  assigneeScopeUserId: string | null;
  selectedConversationId: string | null;
  currentStaffUserId: string;
  widgetHref: string;
  emptyHint: string;
}) {
  const isEmpty = items.length === 0;
  const onboarding = emptyOnboarding(filter, widgetHref);
  const PrimaryIcon = onboarding.primary.Icon;
  const SecondaryIcon = onboarding.secondary?.Icon;

  return (
    <aside className="relative z-[1] flex min-h-0 w-full min-w-[300px] max-w-[420px] flex-col bg-muted/12 shadow-[8px_0_40px_-14px_rgba(15,23,42,0.1),4px_0_24px_-16px_rgba(15,23,42,0.06),inset_1px_0_0_rgba(15,23,42,0.035)] dark:bg-muted/12 dark:shadow-[8px_0_44px_-12px_rgba(0,0,0,0.55),inset_1px_0_0_rgba(255,255,255,0.04)]">
      <div className="from-muted/28 shrink-0 bg-gradient-to-b to-transparent px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div>
            <h2 className="text-foreground text-[13px] font-bold tracking-[-0.02em]">Conversations</h2>
            <p className="text-muted-foreground mt-0.5 text-[10px] font-normal leading-relaxed">
              {isEmpty ? onboarding.listHint : emptyHint}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!isEmpty ? (
              <InboxSortSelect
                sort={sort}
                filter={filter}
                assigneeScopeUserId={assigneeScopeUserId}
                selectedConversationId={selectedConversationId}
              />
            ) : null}
            {!isEmpty ? (
              <span
                className="text-foreground bg-secondary rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums shadow-sm"
                aria-label={`${items.length} in this view`}
              >
                {items.length}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex min-h-0 flex-1 flex-col items-center px-3 py-6 sm:px-4 sm:py-8">
          <div
            className={cn(
              "w-full max-w-[min(100%,22rem)] space-y-6 rounded-lg bg-card p-5 sm:p-6",
              cardElevationClassName
            )}
          >
            <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <div className="text-primary bg-primary/[0.08] relative mb-1 flex size-14 items-center justify-center rounded-xl dark:bg-primary/[0.12]">
                <Inbox className="size-7" strokeWidth={1.35} aria-hidden />
                <Sparkles
                  className="text-primary absolute -top-1 -right-1 size-5 drop-shadow-sm"
                  aria-hidden
                />
              </div>
              <p className="text-primary mt-4 text-[10px] font-bold tracking-[0.18em] uppercase">
                {onboarding.eyebrow}
              </p>
              <h3 className="text-foreground mt-1.5 text-[1.05rem] font-bold leading-tight tracking-[-0.02em] sm:text-[1.125rem]">
                {onboarding.title}
              </h3>
              <p className="text-muted-foreground mt-2 max-w-prose text-[13px] leading-relaxed">
                {onboarding.lede}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-[0.14em] uppercase">
                Next steps
              </p>
              <ol className="space-y-3">
                {onboarding.steps.map((step, index) => (
                  <li key={index} className="flex gap-3 text-left">
                    <span
                      className="text-primary bg-primary/12 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <span className="text-foreground min-w-0 pt-0.5 text-[13px] leading-snug">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <Link
                href={onboarding.primary.href}
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "h-11 w-full justify-center gap-2 text-[13px] font-semibold shadow-sm"
                )}
              >
                <PrimaryIcon className="size-4 shrink-0" aria-hidden />
                {onboarding.primary.label}
              </Link>
              {onboarding.secondary && SecondaryIcon ? (
                <Link
                  href={onboarding.secondary.href}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "h-10 w-full justify-center gap-2 text-[13px] font-semibold"
                  )}
                >
                  <SecondaryIcon className="size-4 shrink-0" aria-hidden />
                  {onboarding.secondary.label}
                </Link>
              ) : null}
            </div>

            {onboarding.footnote ? (
              <p className="text-muted-foreground border-border/80 border-t pt-4 text-center text-[11px] leading-relaxed sm:text-left">
                {onboarding.footnote}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="flex flex-col gap-1.5 p-2 pb-5 sm:p-2.5">
            {items.map((item) => (
              <li key={item.id}>
                <ConversationListRow
                  item={item}
                  filter={filter}
                  sort={sort}
                  assigneeScopeUserId={assigneeScopeUserId}
                  isSelected={item.id === selectedConversationId}
                  currentStaffUserId={currentStaffUserId}
                />
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </aside>
  );
}
