import { z } from "zod";
import type { RoleCode } from "@/domains/auth/roles";

export const quoteStatuses = [
  "draft",
  "ready",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
  "cancelled"
] as const;

export type QuoteStatus = (typeof quoteStatuses)[number];

export const quoteStatusSchema = z.enum(quoteStatuses);

const allowedTransitions: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["ready", "cancelled"],
  ready: ["sent", "draft", "cancelled"],
  sent: ["viewed", "accepted", "rejected", "expired", "cancelled"],
  viewed: ["accepted", "rejected", "expired", "cancelled"],
  accepted: ["cancelled"],
  rejected: [],
  expired: [],
  cancelled: []
};

const quoteRoles: readonly RoleCode[] = ["owner", "admin", "estimator"];
const managerRoles: readonly RoleCode[] = ["owner", "admin"];

export type QuoteTransitionDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/** Mirrors the transition_quote_status database function. */
export function canTransitionQuote(params: {
  currentStatus: QuoteStatus;
  nextStatus: QuoteStatus;
  actorRoles: readonly RoleCode[];
  reason?: string;
  expiresOn?: string | null;
  /** ISO calendar date; required to judge an expiry. */
  today?: string;
  /** True when a job exists for this quote that is not cancelled. */
  hasLiveJob?: boolean;
}): QuoteTransitionDecision {
  const { currentStatus, nextStatus, actorRoles, reason } = params;

  if (!actorRoles.some((role) => quoteRoles.includes(role))) {
    return {
      allowed: false,
      reason: "Only an owner, admin, or estimator can update quotes."
    };
  }

  if (currentStatus === nextStatus) {
    return { allowed: true };
  }

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    return {
      allowed: false,
      reason: `Cannot move a quote from ${currentStatus} to ${nextStatus}.`
    };
  }

  if (currentStatus === "accepted" && nextStatus === "cancelled") {
    if (!actorRoles.some((role) => managerRoles.includes(role))) {
      return {
        allowed: false,
        reason: "Only an owner or admin can cancel an accepted quote."
      };
    }

    if (!reason?.trim()) {
      return {
        allowed: false,
        reason: "Cancelling an accepted quote requires a reason."
      };
    }
  }

  // Cancelling the commercial record while dispatch still has a crew committed
  // leaves the two halves of the business disagreeing.
  if (nextStatus === "cancelled" && params.hasLiveJob) {
    return {
      allowed: false,
      reason: "Cancel the booked job first so dispatch and the customer record agree."
    };
  }

  if (nextStatus === "rejected" && !reason?.trim()) {
    return {
      allowed: false,
      reason: "A reason is required to record a rejection."
    };
  }

  if (nextStatus === "expired" && !isPastExpiry(params.expiresOn, params.today)) {
    return {
      allowed: false,
      reason: "This quote has not reached its expiry date."
    };
  }

  return { allowed: true };
}

/** A quote is only editable while it is still an internal draft. */
export function isQuoteEditable(status: QuoteStatus): boolean {
  return status === "draft" || status === "ready";
}

export function isQuoteOpen(status: QuoteStatus): boolean {
  return status !== "rejected" && status !== "expired" && status !== "cancelled";
}

export function isPastExpiry(expiresOn?: string | null, today?: string): boolean {
  if (!expiresOn || !today) {
    return false;
  }

  return expiresOn < today;
}
