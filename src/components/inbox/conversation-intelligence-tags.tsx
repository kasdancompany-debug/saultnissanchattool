import { Badge } from "@/components/ui/badge";
import {
  deriveConversationIntelligenceTags,
  type ConversationIntelligenceTag,
} from "@/lib/conversation/intelligence-tags";

function tagClassName(tag: ConversationIntelligenceTag): string {
  if (tag.kind === "sales_lead") {
    return "border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-50";
  }
  if (tag.kind === "service_request") {
    return "border-violet-300/80 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-50";
  }
  if (tag.kind === "high_intent") {
    return "border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-50";
  }
  if (tag.kind === "low_intent") {
    return "border-slate-300/80 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100";
  }
  return "border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50";
}

export function ConversationIntelligenceTags({
  content,
  badgeClassName,
}: {
  content: string | null | undefined;
  badgeClassName?: string;
}) {
  const tags = deriveConversationIntelligenceTags(content);
  if (tags.length === 0) {
    return null;
  }

  return (
    <>
      {tags.map((tag, index) => (
        <Badge
          key={`${tag.kind}-${index}`}
          variant="outline"
          className={`${tagClassName(tag)} ${badgeClassName ?? ""}`.trim()}
        >
          {tag.label}
        </Badge>
      ))}
    </>
  );
}
