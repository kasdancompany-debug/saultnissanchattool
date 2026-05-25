import type { Tables } from "@/integrations/supabase/database.types";
import { isPlaceholderCustomerName } from "@/lib/conversation/extract-profile-hints";
import type { InboxConversationCardContext } from "@/lib/inbox/conversation-card";
import type { OpportunitySnapshot } from "@/lib/opportunity/types";

/** Client-safe list row shape (no server-only imports). */
export type InboxConversationListItem = Tables<"conversations"> & {
  customers: {
    display_name: string | null;
    email: string | null;
    phone_e164: string | null;
  } | null;
  assignee: {
    id: string;
    display_name: string;
    email: string;
  } | null;
  last_message_preview: {
    body: string;
    created_at: string;
  } | null;
  opportunity: OpportunitySnapshot;
  card: InboxConversationCardContext;
};

export function getCustomerDisplayName(
  customer: InboxConversationListItem["customers"],
  fallbackTitle: string | null
): string {
  const display = customer?.display_name?.trim();
  if (display && !isPlaceholderCustomerName(display)) {
    return display;
  }
  if (customer?.phone_e164) {
    return customer.phone_e164;
  }
  if (customer?.email) {
    return customer.email;
  }
  if (fallbackTitle?.trim()) {
    return fallbackTitle.trim();
  }
  return "Unknown customer";
}
