import type { OrganizationId, StaffUserId } from "./ids";

export type StaffRole = "sales" | "service" | "bdc" | "manager" | "admin";

export interface StaffProfile {
  userId: StaffUserId;
  organizationId: OrganizationId;
  displayName: string;
  role: StaffRole;
  isActive: boolean;
  /** ISO 8601 UTC */
  updatedAt: string;
}
