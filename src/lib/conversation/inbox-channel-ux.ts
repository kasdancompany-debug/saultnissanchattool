import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Globe,
  Mail,
  MessageCircle,
  Phone,
  Radio,
  Smartphone,
} from "lucide-react";

import type { InboxChannelSurfaceId } from "@/lib/conversation/inbox-channel-surface";

/** Lucide icon per surface — swap for brand SVGs later without changing layout contracts. */
export function inboxChannelSurfaceIcon(surface: InboxChannelSurfaceId): LucideIcon {
  switch (surface) {
    case "web_chat":
      return Globe;
    case "sms":
      return Smartphone;
    case "messenger":
      return MessageCircle;
    case "instagram":
      return Camera;
    case "whatsapp":
      return Phone;
    case "email":
      return Mail;
    case "other":
      return Radio;
  }
}

/** Short line for thread header / tooltips — omnichannel context, not marketing fluff. */
export function inboxChannelSurfaceTagline(surface: InboxChannelSurfaceId): string {
  switch (surface) {
    case "sms":
      return "SMS thread — replies send as text to the customer.";
    case "web_chat":
      return "Live chat from your website widget.";
    case "messenger":
      return "Meta Messenger direct message.";
    case "instagram":
      return "Instagram direct message.";
    case "whatsapp":
      return "WhatsApp conversation.";
    case "email":
      return "Email thread.";
    case "other":
      return "External messaging channel.";
  }
}

/** Second line when a thread has no messages yet — reinforces omnichannel context. */
export function inboxChannelThreadEmptyBody(surface: InboxChannelSurfaceId): string {
  switch (surface) {
    case "sms":
      return "When the customer texts this number, messages appear here in order with full timestamps.";
    case "web_chat":
      return "When the customer sends a message from your site widget, it lands here like any other channel.";
    case "messenger":
      return "When they message your Page on Messenger, the thread builds here the same way as SMS or web chat.";
    case "instagram":
      return "Instagram DMs from this account show up here so you can reply without switching apps.";
    case "whatsapp":
      return "WhatsApp messages on this linked number will appear here when the customer writes first.";
    case "email":
      return "Inbound email on this thread will show up here with timestamps.";
    case "other":
      return "When the customer sends a message, it will show up here in order with full timestamps.";
  }
}

/** Composer / footer — clarifies delivery path without exposing infrastructure. */
export function inboxChannelReplyFootnote(surface: InboxChannelSurfaceId): string {
  switch (surface) {
    case "sms":
      return "Your reply is delivered as an SMS.";
    case "web_chat":
      return "Your reply appears in the customer’s browser chat.";
    case "messenger":
    case "instagram":
    case "whatsapp":
      return "Your reply follows this Meta thread’s delivery rules.";
    case "email":
      return "Your reply is sent on this email thread.";
    case "other":
      return "Your reply uses this channel’s configured delivery.";
  }
}

/** Vertical accent on channel pills (left bar) — subtle, channel-tinted. */
export function inboxChannelSurfaceAccentBarClass(surface: InboxChannelSurfaceId): string {
  switch (surface) {
    case "sms":
      return "bg-sky-500";
    case "web_chat":
      return "bg-slate-500 dark:bg-slate-400";
    case "messenger":
      return "bg-blue-600";
    case "instagram":
      return "bg-fuchsia-600";
    case "whatsapp":
      return "bg-emerald-600";
    case "email":
      return "bg-slate-500";
    case "other":
      return "bg-muted-foreground/60";
  }
}

/** Small avatar-corner chip: icon tint + soft wash (pairs with {@link inboxChannelSurfaceIcon}). */
export function inboxChannelSurfaceAvatarChipClass(surface: InboxChannelSurfaceId): string {
  switch (surface) {
    case "sms":
      return "border-sky-500/35 bg-sky-500/12 text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-100";
    case "web_chat":
      return "border-violet-500/35 bg-violet-500/12 text-violet-900 dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-100";
    case "messenger":
      return "border-blue-600/35 bg-blue-600/12 text-blue-950 dark:border-blue-400/30 dark:bg-blue-600/15 dark:text-blue-50";
    case "instagram":
      return "border-fuchsia-600/35 bg-fuchsia-600/12 text-fuchsia-950 dark:border-fuchsia-400/30 dark:bg-fuchsia-600/15 dark:text-fuchsia-50";
    case "whatsapp":
      return "border-emerald-600/35 bg-emerald-600/12 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-600/15 dark:text-emerald-50";
    case "email":
      return "border-slate-500/35 bg-slate-500/10 text-slate-900 dark:border-slate-400/30 dark:bg-slate-500/15 dark:text-slate-100";
    case "other":
      return "border-border bg-muted/60 text-muted-foreground";
  }
}
