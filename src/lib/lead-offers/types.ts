import type { StaffDepartment } from "@/integrations/supabase/database.types";

import type { LeadOfferEventType as DbLeadOfferEventType } from "@/types/supabase";

export type LeadOfferEventType = DbLeadOfferEventType;

export type LeadOfferRow = {
  id: string;
  dealership_id: string;
  name: string;
  description: string;
  is_active: boolean;
  department: StaffDepartment;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  cta_text: string;
  created_at: string;
  updated_at: string;
};

export type LeadOfferMetrics = {
  offerId: string;
  offerName: string;
  views: number;
  starts: number;
  completes: number;
  leads: number;
  completionRate: number | null;
};

export type DealershipLeadOfferAnalytics = {
  totals: {
    views: number;
    starts: number;
    completes: number;
    leads: number;
    completionRate: number | null;
  };
  byOffer: LeadOfferMetrics[];
};
