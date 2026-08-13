import { z } from "zod";
import type { RoleCode } from "@/domains/auth/roles";

export const leadStatuses = [
  "new",
  "contacting",
  "qualified",
  "estimate_pending",
  "quote_pending",
  "won",
  "unresponsive",
  "disqualified",
  "lost"
] as const;

export type LeadStatus = (typeof leadStatuses)[number];

export const leadStatusSchema = z.enum(leadStatuses);

const terminalStatuses = new Set<LeadStatus>([
  "won",
  "unresponsive",
  "disqualified",
  "lost"
]);

const allowedTransitions: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacting", "qualified", "unresponsive", "disqualified"],
  contacting: ["qualified", "unresponsive", "disqualified", "lost"],
  qualified: ["estimate_pending", "quote_pending", "lost", "disqualified"],
  estimate_pending: ["quote_pending", "lost", "disqualified"],
  quote_pending: ["won", "lost", "disqualified"],
  won: [],
  unresponsive: [],
  disqualified: [],
  lost: []
};

export type LeadTransitionDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export function canTransitionLeadStatus(
  currentStatus: LeadStatus,
  nextStatus: LeadStatus,
  actorRoles: readonly RoleCode[],
  reason?: string
): LeadTransitionDecision {
  if (currentStatus === nextStatus) {
    return { allowed: true };
  }

  if (terminalStatuses.has(currentStatus)) {
    const canReopen = actorRoles.includes("owner") || actorRoles.includes("admin");
    if (!canReopen) {
      return {
        allowed: false,
        reason: "Only owner or admin can reopen a terminal lead."
      };
    }
  } else if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    return {
      allowed: false,
      reason: `Cannot move a lead from ${currentStatus} to ${nextStatus}.`
    };
  }

  if ((nextStatus === "disqualified" || nextStatus === "lost") && !reason?.trim()) {
    return {
      allowed: false,
      reason: "A reason is required for lost or disqualified leads."
    };
  }

  return { allowed: true };
}
