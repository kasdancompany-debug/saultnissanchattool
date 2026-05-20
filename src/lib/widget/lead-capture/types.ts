/** Guided intake paths — replaces generic “type a message” for new visitors. */
export type LeadIntent =
  | "new_vehicle"
  | "used_vehicle"
  | "trade_value"
  | "service"
  | "financing"
  | "general";

export type LeadCondition = "excellent" | "good" | "fair" | "needs_work";

export type LeadTimeline =
  | "asap"
  | "two_weeks"
  | "one_to_three_months"
  | "browsing";

export type LeadFinancingInterest = "yes" | "no" | "maybe";

/** Payload sent to `POST /api/widget/conversations` when intake completes. */
export type WidgetLeadCapturePayload = {
  intent: LeadIntent;
  name: string;
  phone_e164: string;
  email?: string | null;
  vehicle_interest?: string | null;
  trade_vehicle?: string | null;
  trade_year?: string | null;
  trade_km?: string | null;
  trade_condition?: LeadCondition | null;
  timeline?: LeadTimeline | null;
  financing_interest?: LeadFinancingInterest | null;
  general_question?: string | null;
  service_need?: string | null;
};

export type LeadStepKind =
  | "intent_cards"
  | "assistant"
  | "text"
  | "phone"
  | "email_optional"
  | "choice";

export type LeadChoiceOption = {
  id: string;
  label: string;
};

export type LeadFlowStep = {
  id: string;
  kind: LeadStepKind;
  /** Assistant copy (also used as prompt above inputs). */
  prompt?: string;
  placeholder?: string;
  field?: keyof WidgetLeadCapturePayload | "trade_vehicle" | "trade_year" | "trade_km";
  options?: LeadChoiceOption[];
  required?: boolean;
};

export type LeadIntentCard = {
  intent: LeadIntent;
  emoji: string;
  title: string;
  subtitle: string;
};
