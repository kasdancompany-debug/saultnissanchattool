import type { StaffDepartment } from "@/integrations/supabase/database.types";
import type { OpportunityScoreBand } from "@/lib/opportunity/types";
import type { AiAssistPanelView } from "@/types/ai-assist-panel";

export type AiCopilotCustomerProfile = {
  displayName: string;
  email: string | null;
  phoneE164: string | null;
  notes: string | null;
  missingFields: string[];
};

export type AiCopilotView = {
  routingDepartment: StaffDepartment;
  routingDepartmentLabel: string;
  intentSummary: string;
  intentLevel: OpportunityScoreBand;
  intentLevelLabel: string;
  summary: string;
  nextActions: string[];
  suggestedResponses: string[];
  customerProfile: AiCopilotCustomerProfile;
  likelyObjections: string[];
  opportunityScore: number;
  appointmentProbability: number;
  appointmentProbabilityLabel: string;
  recommendedInventory: string[];
  primaryDraftReply: string;
  classification: AiAssistPanelView | null;
};
