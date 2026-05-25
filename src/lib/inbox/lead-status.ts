import type { ConversationStatus } from "@/integrations/supabase/database.types";
import { readPipelineFromMetadata } from "@/lib/conversation/pipeline-outcomes";
import { readOpportunityFromMetadata } from "@/lib/opportunity/metadata";

export type InboxLeadStatus = "new" | "working" | "appointment" | "sold" | "lost";

const SOLD_RE = /\b(purchased|bought|sold|delivery|picked up|took delivery)\b/i;
const LOST_RE = /\b(not interested|went elsewhere|bought elsewhere|no longer|cancelled)\b/i;
const APPOINTMENT_RE =
  /\b(appointment|book(?:ing)?|schedule|test drive|come in|visit)\b/i;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export const LEAD_STATUS_LABEL: Record<InboxLeadStatus, string> = {
  new: "New",
  working: "Working",
  appointment: "Appointment",
  sold: "Sold",
  lost: "Lost",
};

export function deriveInboxLeadStatus(input: {
  status: ConversationStatus;
  department: string;
  metadata: unknown;
  hasAssignee: boolean;
  createdAtIso: string;
}): InboxLeadStatus {
  const meta = asRecord(input.metadata);
  const blob = JSON.stringify(meta);
  const pipeline = readPipelineFromMetadata(meta);

  if (pipeline.sold) return "sold";
  if (pipeline.lost) return "lost";
  if (pipeline.appointment) return "appointment";

  if (input.status === "spam") return "lost";
  if (input.status === "closed" || input.status === "resolved" || input.status === "archived") {
    if (meta.sold === true || SOLD_RE.test(blob)) return "sold";
    if (meta.lost === true || LOST_RE.test(blob)) return "lost";
    return input.department === "sales" ? "sold" : "lost";
  }

  const opp = readOpportunityFromMetadata(meta);
  if (opp?.signals.some((s) => s.id === "appointment" && s.active)) {
    return "appointment";
  }
  if (APPOINTMENT_RE.test(blob)) {
    return "appointment";
  }

  if (input.hasAssignee) return "working";

  const created = new Date(input.createdAtIso).getTime();
  const ageHours = (Date.now() - created) / (1000 * 60 * 60);
  if (ageHours <= 72 && !input.hasAssignee) return "new";

  return "working";
}

export function leadStatusPillClass(status: InboxLeadStatus): string {
  switch (status) {
    case "new":
      return "border-sky-400/50 bg-sky-500/10 text-sky-950 dark:text-sky-100";
    case "working":
      return "border-slate-400/40 bg-slate-500/8 text-slate-800 dark:text-slate-200";
    case "appointment":
      return "border-violet-400/50 bg-violet-500/10 text-violet-950 dark:text-violet-100";
    case "sold":
      return "border-emerald-400/50 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100";
    case "lost":
      return "border-rose-400/40 bg-rose-500/8 text-rose-900/90 dark:text-rose-100";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}
