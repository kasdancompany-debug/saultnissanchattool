import type { InboxChannelSurfaceId } from "@/lib/conversation/inbox-channel-surface";
import { inboxChannelSurfaceLabel } from "@/lib/conversation/inbox-channel-surface";
import {
  inboxChannelSurfaceAccentBarClass,
  inboxChannelSurfaceAvatarChipClass,
  inboxChannelSurfaceIcon,
  inboxChannelSurfaceTagline,
} from "@/lib/conversation/inbox-channel-ux";
import { cn } from "@/lib/utils";

const sizeStyles = {
  sm: "h-5 gap-0 pl-0 pr-1.5 text-[10px] leading-none",
  md: "h-6 gap-0 pl-0 pr-2 text-[11px] leading-none",
} as const;

const iconSizeClass: Record<keyof typeof sizeStyles, string> = {
  sm: "size-3",
  md: "size-3.5",
};

export function ConversationChannelBadge({
  surfaceId,
  size = "sm",
  className,
}: {
  surfaceId: InboxChannelSurfaceId;
  size?: keyof typeof sizeStyles;
  className?: string;
}) {
  const label = inboxChannelSurfaceLabel(surfaceId);
  const tagline = inboxChannelSurfaceTagline(surfaceId);
  const Icon = inboxChannelSurfaceIcon(surfaceId);
  const accent = inboxChannelSurfaceAccentBarClass(surfaceId);
  const iconClass = iconSizeClass[size];

  return (
    <span
      className={cn(
        "border-border/70 bg-muted/40 text-foreground/92 inline-flex max-w-[200px] shrink-0 items-center overflow-hidden rounded-md border font-semibold tracking-tight shadow-sm",
        sizeStyles[size],
        className
      )}
      title={`${label} — ${tagline}`}
    >
      <span
        className={cn("w-[3px] shrink-0 self-stretch rounded-full", accent)}
        aria-hidden
      />
      <span
        className="text-foreground/85 flex w-5 shrink-0 items-center justify-center pl-0.5 opacity-90"
        aria-hidden
      >
        <Icon className={cn(iconClass, "shrink-0")} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 truncate py-0.5">{label}</span>
      <span className="sr-only">
        {label}. {tagline}
      </span>
    </span>
  );
}

/**
 * Corner chip on the customer avatar in the conversation list — same channel icon as the row
 * badge, reserved layout for future brand marks.
 */
export function ConversationChannelAvatarChip({
  surfaceId,
  className,
}: {
  surfaceId: InboxChannelSurfaceId;
  className?: string;
}) {
  const Icon = inboxChannelSurfaceIcon(surfaceId);
  const label = inboxChannelSurfaceLabel(surfaceId);
  const chip = inboxChannelSurfaceAvatarChipClass(surfaceId);

  return (
    <span
      className={cn(
        "border-background pointer-events-none absolute -right-1 -bottom-1 flex size-[1.05rem] items-center justify-center rounded-full border-2 shadow-[0_2px_8px_rgba(15,23,42,0.2)] ring-1 ring-black/[0.05] dark:ring-white/[0.07]",
        chip,
        className
      )}
      title={label}
      aria-hidden
    >
      <Icon className="size-2 min-h-2 min-w-2" strokeWidth={2.35} />
    </span>
  );
}
