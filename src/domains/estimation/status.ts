import { z } from "zod";
import type { RoleCode } from "@/domains/auth/roles";

export const estimateStatuses = [
  "draft",
  "generated",
  "under_review",
  "approved",
  "rejected"
] as const;

export type EstimateStatus = (typeof estimateStatuses)[number];

export const estimateStatusSchema = z.enum(estimateStatuses);

const allowedTransitions: Record<EstimateStatus, EstimateStatus[]> = {
  draft: ["generated", "under_review"],
  generated: ["under_review"],
  under_review: ["approved", "rejected"],
  approved: [],
  rejected: ["under_review"]
};

const reviewerRoles: readonly RoleCode[] = ["owner", "admin"];
const preparerRoles: readonly RoleCode[] = ["owner", "admin", "estimator"];

export type EstimateReviewDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Mirrors the review_estimate database function. An estimator prepares and
 * submits a price; accepting or refusing it is an owner/admin decision, so the
 * person who priced a move is not the only person who approves it.
 */
export function canReviewEstimate(
  currentStatus: EstimateStatus,
  nextStatus: EstimateStatus,
  actorRoles: readonly RoleCode[],
  reason?: string
): EstimateReviewDecision {
  if (!actorRoles.some((role) => preparerRoles.includes(role))) {
    return {
      allowed: false,
      reason: "Only an owner, admin, or estimator can review estimates."
    };
  }

  if (currentStatus === nextStatus) {
    return { allowed: true };
  }

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    return {
      allowed: false,
      reason: `Cannot move an estimate from ${currentStatus} to ${nextStatus}.`
    };
  }

  const isReviewDecision = nextStatus === "approved" || nextStatus === "rejected";

  if (isReviewDecision && !actorRoles.some((role) => reviewerRoles.includes(role))) {
    return {
      allowed: false,
      reason: "Only an owner or admin can approve or reject an estimate."
    };
  }

  if (nextStatus === "rejected" && !reason?.trim()) {
    return {
      allowed: false,
      reason: "A reason is required to reject an estimate."
    };
  }

  return { allowed: true };
}

/** An approved or rejected estimate is a historical record, not a working draft. */
export function isEstimateEditable(status: EstimateStatus): boolean {
  return status !== "approved" && status !== "rejected";
}
