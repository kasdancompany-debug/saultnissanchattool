"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { stepsForLeadIntent } from "@/lib/widget/lead-capture/flows";
import type {
  LeadFlowStep,
  LeadIntent,
  WidgetLeadCapturePayload,
} from "@/lib/widget/lead-capture/types";
import { normalizeE164 } from "@/lib/phone/e164";

export type LeadTranscriptLine = {
  id: string;
  role: "assistant" | "customer";
  body: string;
};

function lineId(): string {
  return `l-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useLeadCaptureFlow() {
  const [intent, setIntent] = useState<LeadIntent | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [transcript, setTranscript] = useState<LeadTranscriptLine[]>([]);

  const steps = useMemo(
    () => (intent ? stepsForLeadIntent(intent) : []),
    [intent]
  );

  const currentStep: LeadFlowStep | null = steps[stepIndex] ?? null;

  const pushLine = useCallback((role: LeadTranscriptLine["role"], body: string) => {
    setTranscript((t) => [...t, { id: lineId(), role, body }]);
  }, []);

  const pendingFirstAnswerRef = useRef<string | null>(null);

  const resetToMenu = useCallback(() => {
    pendingFirstAnswerRef.current = null;
    setIntent(null);
    setStepIndex(0);
    setAnswers({});
    setTranscript([]);
  }, []);

  const selectIntent = useCallback((next: LeadIntent, cardTitle: string) => {
    const flowSteps = stepsForLeadIntent(next);
    let startIndex = 0;
    const lines: LeadTranscriptLine[] = [
      {
        id: lineId(),
        role: "assistant",
        body: "Welcome to Sault Nissan 👋\n\nWhat can we help with today?",
      },
      { id: lineId(), role: "customer", body: cardTitle },
    ];
    const first = flowSteps[0];
    if (first?.kind === "assistant" && first.prompt) {
      lines.push({ id: lineId(), role: "assistant", body: first.prompt });
      startIndex = 1;
    }
    setIntent(next);
    setStepIndex(startIndex);
    setAnswers({});
    setTranscript(lines);
  }, []);

  const selectIntentWithFirstAnswer = useCallback(
    (next: LeadIntent, cardTitle: string, answer: string) => {
      const trimmed = answer.trim();
      if (!trimmed) return;
      selectIntent(next, cardTitle);
      pendingFirstAnswerRef.current = trimmed;
    },
    [selectIntent]
  );

  const advance = useCallback(() => {
    setStepIndex((i) => {
      const next = steps[i + 1];
      if (next?.kind === "assistant" && next.prompt) {
        pushLine("assistant", next.prompt);
      }
      return i + 1;
    });
  }, [pushLine, steps]);

  const submitAnswer = useCallback(
    (value: string, displayLabel?: string) => {
      if (!currentStep) return;
      const trimmed = value.trim();
      if (currentStep.required !== false && !trimmed) return;

      pushLine("customer", displayLabel ?? trimmed);

      if (currentStep.field) {
        const stored =
          currentStep.kind === "phone" ? normalizeE164(trimmed) : trimmed;
        setAnswers((a) => ({ ...a, [currentStep.field!]: stored }));
      }

      advance();
    },
    [advance, currentStep, pushLine]
  );

  const skipEmail = useCallback(() => {
    if (currentStep?.kind !== "email_optional") return;
    pushLine("customer", "Skip email");
    advance();
  }, [advance, currentStep, pushLine]);

  const buildPayload = useCallback((): WidgetLeadCapturePayload | null => {
    if (!intent) return null;
    const phoneRaw = answers.phone_e164 ?? "";
    const phone = normalizeE164(phoneRaw);
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) return null;
    const name = (answers.name ?? "").trim();
    if (!name) return null;

    return {
      intent,
      name,
      phone_e164: phone,
      email: answers.email?.trim() || null,
      vehicle_interest: answers.vehicle_interest ?? null,
      trade_vehicle: answers.trade_vehicle ?? null,
      trade_year: answers.trade_year ?? null,
      trade_km: answers.trade_km ?? null,
      trade_condition:
        (answers.trade_condition as WidgetLeadCapturePayload["trade_condition"]) ??
        null,
      timeline:
        (answers.timeline as WidgetLeadCapturePayload["timeline"]) ?? null,
      financing_interest:
        (answers.financing_interest as WidgetLeadCapturePayload["financing_interest"]) ??
        null,
      general_question: answers.general_question ?? null,
      service_need: answers.service_need ?? null,
    };
  }, [answers, intent]);

  const isComplete = stepIndex >= steps.length && steps.length > 0;

  const inputSteps = useMemo(
    () => steps.filter((s) => s.kind !== "assistant"),
    [steps]
  );
  const inputStepNumber =
    currentStep && currentStep.kind !== "assistant"
      ? inputSteps.findIndex((s) => s.id === currentStep.id) + 1
      : 0;

  return {
    intent,
    steps,
    stepIndex,
    currentStep,
    transcript,
    selectIntent,
    selectIntentWithFirstAnswer,
    resetToMenu,
    pendingFirstAnswerRef,
    submitAnswer,
    skipEmail,
    buildPayload,
    isComplete,
    pushLine,
    inputStepNumber,
    inputStepTotal: inputSteps.length,
  };
}
