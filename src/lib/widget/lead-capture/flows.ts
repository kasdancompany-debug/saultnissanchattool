import type { LeadFlowStep, LeadIntent } from "@/lib/widget/lead-capture/types";

const TIMELINE_OPTIONS = [
  { id: "asap", label: "ASAP" },
  { id: "two_weeks", label: "1–2 weeks" },
  { id: "one_to_three_months", label: "1–3 months" },
  { id: "browsing", label: "Just browsing" },
];

const FINANCING_OPTIONS = [
  { id: "yes", label: "Yes, interested" },
  { id: "maybe", label: "Maybe — tell me more" },
  { id: "no", label: "Not right now" },
];

const CONDITION_OPTIONS = [
  { id: "excellent", label: "Excellent" },
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
  { id: "needs_work", label: "Needs work" },
];

const NAME_PHONE_EMAIL: LeadFlowStep[] = [
  {
    id: "name",
    kind: "text",
    prompt: "What's your first name?",
    placeholder: "Your name",
    field: "name",
    required: true,
  },
  {
    id: "phone",
    kind: "phone",
    prompt: "Where should we reach you?",
    placeholder: "Mobile number",
    field: "phone_e164",
    required: true,
  },
  {
    id: "email",
    kind: "email_optional",
    prompt: "Email (optional) — for your estimate or follow-up details.",
    placeholder: "you@email.com",
    field: "email",
    required: false,
  },
];

const FLOWS: Record<LeadIntent, LeadFlowStep[]> = {
  trade_value: [
    {
      id: "intro",
      kind: "assistant",
      prompt: "Get your trade estimate in under 60 seconds.",
    },
    {
      id: "trade_vehicle",
      kind: "text",
      prompt: "What vehicle do you currently drive?",
      placeholder: "e.g. 2019 Toyota Tacoma",
      field: "trade_vehicle",
      required: true,
    },
    {
      id: "trade_year",
      kind: "text",
      prompt: "What year?",
      placeholder: "e.g. 2019",
      field: "trade_year",
      required: true,
    },
    {
      id: "trade_km",
      kind: "text",
      prompt: "Approximate KM?",
      placeholder: "e.g. 85,000",
      field: "trade_km",
      required: true,
    },
    {
      id: "trade_condition",
      kind: "choice",
      prompt: "What condition best describes it?",
      field: "trade_condition",
      options: CONDITION_OPTIONS,
      required: true,
    },
    ...NAME_PHONE_EMAIL,
  ],
  new_vehicle: [
    {
      id: "intro",
      kind: "assistant",
      prompt: "Let's find the right new Nissan for you.",
    },
    {
      id: "vehicle_interest",
      kind: "text",
      prompt: "Which model or type are you interested in?",
      placeholder: "e.g. Rogue, Sentra, or electric SUV",
      field: "vehicle_interest",
      required: true,
    },
    {
      id: "timeline",
      kind: "choice",
      prompt: "When are you hoping to make a decision?",
      field: "timeline",
      options: TIMELINE_OPTIONS,
      required: true,
    },
    {
      id: "financing",
      kind: "choice",
      prompt: "Interested in financing options?",
      field: "financing_interest",
      options: FINANCING_OPTIONS,
      required: true,
    },
    ...NAME_PHONE_EMAIL,
  ],
  used_vehicle: [
    {
      id: "intro",
      kind: "assistant",
      prompt: "We'll help you find the right pre-owned match.",
    },
    {
      id: "vehicle_interest",
      kind: "text",
      prompt: "What are you looking for?",
      placeholder: "Make, model, or body style",
      field: "vehicle_interest",
      required: true,
    },
    {
      id: "timeline",
      kind: "choice",
      prompt: "What's your timeline?",
      field: "timeline",
      options: TIMELINE_OPTIONS,
      required: true,
    },
    {
      id: "financing",
      kind: "choice",
      prompt: "Interested in financing?",
      field: "financing_interest",
      options: FINANCING_OPTIONS,
      required: true,
    },
    ...NAME_PHONE_EMAIL,
  ],
  financing: [
    {
      id: "intro",
      kind: "assistant",
      prompt: "We can connect you with a specialist — no pressure.",
    },
    {
      id: "vehicle_interest",
      kind: "text",
      prompt: "What vehicle are you considering?",
      placeholder: "Model or budget range",
      field: "vehicle_interest",
      required: true,
    },
    {
      id: "timeline",
      kind: "choice",
      prompt: "When are you looking to buy?",
      field: "timeline",
      options: TIMELINE_OPTIONS,
      required: true,
    },
    ...NAME_PHONE_EMAIL,
  ],
  service: [
    {
      id: "intro",
      kind: "assistant",
      prompt: "We'll get your service request to the right advisor.",
    },
    {
      id: "vehicle_interest",
      kind: "text",
      prompt: "What's your vehicle year, make & model?",
      placeholder: "e.g. 2021 Nissan Rogue",
      field: "vehicle_interest",
      required: true,
    },
    {
      id: "service_need",
      kind: "text",
      prompt: "What do you need help with?",
      placeholder: "Oil change, brakes, noise, etc.",
      field: "service_need",
      required: true,
    },
    ...NAME_PHONE_EMAIL,
  ],
  general: [
    {
      id: "intro",
      kind: "assistant",
      prompt: "Happy to help — a quick detail helps us route you faster.",
    },
    {
      id: "general_question",
      kind: "text",
      prompt: "What can we help you with?",
      placeholder: "Your question",
      field: "general_question",
      required: true,
    },
    ...NAME_PHONE_EMAIL,
  ],
};

export function stepsForLeadIntent(intent: LeadIntent): LeadFlowStep[] {
  return FLOWS[intent];
}

export function intentLabel(intent: LeadIntent): string {
  switch (intent) {
    case "new_vehicle":
      return "New vehicle";
    case "used_vehicle":
      return "Used vehicle";
    case "trade_value":
      return "Trade value";
    case "service":
      return "Service";
    case "financing":
      return "Financing";
    case "general":
      return "General question";
    default:
      return "Lead";
  }
}
