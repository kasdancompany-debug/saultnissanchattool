import { describe, expect, it } from "vitest";

import {
  mergeInboxThreadTimeline,
  timelineActivityFromConversationEvent,
} from "@/lib/inbox/conversation-timeline";
import type { InboxMessageView } from "@/lib/inbox/inbox-message-view";
import type { TimelineSourceEvent } from "@/lib/inbox/inbox-timeline-types";

function message(overrides: Partial<InboxMessageView> = {}): InboxMessageView {
  return {
    id: "msg-1",
    conversation_id: "conv-1",
    sender_type: "customer",
    sender_user_id: null,
    body: "Can I book service tomorrow?",
    raw_payload: {},
    delivery_status: "delivered",
    metadata: {},
    twilio_inbound_sid: null,
    twilio_outbound_sid: null,
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
    sender_label: "Jordan",
    ...overrides,
  };
}

function event(overrides: Partial<TimelineSourceEvent> = {}): TimelineSourceEvent {
  return {
    id: "evt-1",
    event_type: "metadata_changed",
    actor_user_id: "staff-1",
    created_at: "2026-06-01T12:05:00.000Z",
    payload: {},
    ...overrides,
  };
}

describe("conversation timeline", () => {
  it("parses appointment confirmed activity", () => {
    const activity = timelineActivityFromConversationEvent(
      event({
        payload: {
          kind: "appointment_confirmed",
          department: "service",
          confirmed_at: "2026-06-02T15:00:00.000Z",
        },
      }),
      new Map([["staff-1", "Alex Advisor"]])
    );
    expect(activity?.title).toBe("Appointment confirmed");
    expect(activity?.tone).toBe("confirmed");
    expect(activity?.actorLabel).toBe("Alex Advisor");
    expect(activity?.detail).toContain("Service");
  });

  it("parses service scheduler link activity", () => {
    const activity = timelineActivityFromConversationEvent(
      event({
        event_type: "service_scheduler_link_sent",
        payload: {
          url: "https://dealer.example/service",
          sent_by_user_id: "staff-1",
        },
      }),
      new Map([["staff-1", "Alex Advisor"]])
    );
    expect(activity?.title).toBe("Service scheduling link sent");
    expect(activity?.tone).toBe("scheduler");
  });

  it("merges messages and activities chronologically", () => {
    const merged = mergeInboxThreadTimeline({
      messages: [message()],
      events: [
        event({
          id: "evt-intent",
          created_at: "2026-06-01T12:02:00.000Z",
          actor_user_id: null,
          payload: {
            kind: "appointment_intent_detected",
            confidence: 72,
            department: "service",
          },
        }),
        event({
          id: "evt-confirmed",
          created_at: "2026-06-01T12:10:00.000Z",
          payload: {
            kind: "appointment_confirmed",
            department: "service",
            confirmed_at: "2026-06-02T15:00:00.000Z",
          },
        }),
      ],
      staffNameById: new Map(),
    });

    expect(merged).toHaveLength(3);
    expect(merged[0]?.type).toBe("message");
    expect(merged[1]?.type).toBe("activity");
    if (merged[1]?.type === "activity") {
      expect(merged[1].activity.kind).toBe("appointment_intent_detected");
    }
    expect(merged[2]?.type).toBe("activity");
  });

  it("hides redundant appointment confirmed system messages", () => {
    const merged = mergeInboxThreadTimeline({
      messages: [
        message(),
        message({
          id: "sys-1",
          sender_type: "system",
          sender_label: "System",
          body: "Appointment confirmed.",
          metadata: { kind: "appointment_confirmed" },
          created_at: "2026-06-01T12:10:00.000Z",
        }),
      ],
      events: [
        event({
          created_at: "2026-06-01T12:10:00.000Z",
          payload: { kind: "appointment_confirmed", department: "sales" },
        }),
      ],
      staffNameById: new Map(),
    });

    const messageItems = merged.filter((i) => i.type === "message");
    expect(messageItems).toHaveLength(1);
    expect(merged.some((i) => i.type === "activity")).toBe(true);
  });
});
