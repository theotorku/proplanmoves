import { z } from "zod";
import type { RoleCode } from "@/domains/auth/roles";

export const leadAssigneeFilterSchema = z
  .union([z.literal("all"), z.literal("unassigned"), z.string().uuid()])
  .default("all");

export type LeadAssigneeFilter = z.infer<typeof leadAssigneeFilterSchema>;

export type AssignableStaff = {
  profileId: string;
  fullName: string;
  roles: RoleCode[];
};

export type LeadAssignmentDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

const managerRoles: readonly RoleCode[] = ["owner", "admin"];
const assigningRoles: readonly RoleCode[] = ["owner", "admin", "estimator"];

/**
 * Mirrors the authorization branches of the assign_lead database function so
 * the UI can hide or explain a rejection before the round trip. The database
 * remains the enforcing copy.
 */
export function canAssignLead(params: {
  actorRoles: readonly RoleCode[];
  actorProfileId: string;
  currentAssigneeProfileId: string | null;
  nextAssigneeProfileId: string | null;
}): LeadAssignmentDecision {
  const { actorRoles, actorProfileId, currentAssigneeProfileId, nextAssigneeProfileId } = params;

  if (!actorRoles.some((role) => assigningRoles.includes(role))) {
    return {
      allowed: false,
      reason: "Only an owner, admin, or estimator can assign leads."
    };
  }

  if (actorRoles.some((role) => managerRoles.includes(role))) {
    return { allowed: true };
  }

  const claimsForSelf =
    nextAssigneeProfileId === actorProfileId &&
    (currentAssigneeProfileId === null || currentAssigneeProfileId === actorProfileId);
  const releasesOwn =
    nextAssigneeProfileId === null && currentAssigneeProfileId === actorProfileId;

  if (!claimsForSelf && !releasesOwn) {
    return {
      allowed: false,
      reason: "Only an owner or admin can change another operator's lead assignment."
    };
  }

  return { allowed: true };
}
