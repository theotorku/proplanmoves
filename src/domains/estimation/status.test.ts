import { describe, expect, it } from "vitest";
import { canReviewEstimate, isEstimateEditable } from "./status";

describe("canReviewEstimate", () => {
  it("lets an estimator submit a generated estimate for review", () => {
    expect(canReviewEstimate("generated", "under_review", ["estimator"])).toEqual({
      allowed: true
    });
  });

  it("stops an estimator from approving their own estimate", () => {
    expect(canReviewEstimate("under_review", "approved", ["estimator"])).toEqual({
      allowed: false,
      reason: "Only an owner or admin can approve or reject an estimate."
    });
  });

  it("lets an admin approve an estimate under review", () => {
    expect(canReviewEstimate("under_review", "approved", ["admin"])).toEqual({ allowed: true });
  });

  it("requires a reason to reject", () => {
    expect(canReviewEstimate("under_review", "rejected", ["owner"])).toEqual({
      allowed: false,
      reason: "A reason is required to reject an estimate."
    });
    expect(canReviewEstimate("under_review", "rejected", ["owner"], "Access notes are wrong")).toEqual({
      allowed: true
    });
  });

  it("rejects transitions that skip review", () => {
    const decision = canReviewEstimate("generated", "approved", ["owner"]);

    expect(decision).toEqual({
      allowed: false,
      reason: "Cannot move an estimate from generated to approved."
    });
  });

  it("treats an approved estimate as final", () => {
    expect(canReviewEstimate("approved", "under_review", ["owner"]).allowed).toBe(false);
    expect(canReviewEstimate("approved", "rejected", ["owner"]).allowed).toBe(false);
  });

  it("allows a rejected estimate to be reworked and resubmitted", () => {
    expect(canReviewEstimate("rejected", "under_review", ["estimator"])).toEqual({ allowed: true });
  });

  it("keeps roles without estimating rights out", () => {
    expect(canReviewEstimate("generated", "under_review", ["dispatcher"]).allowed).toBe(false);
    expect(canReviewEstimate("generated", "under_review", ["viewer"]).allowed).toBe(false);
  });
});

describe("isEstimateEditable", () => {
  it("allows edits before a review decision", () => {
    expect(isEstimateEditable("draft")).toBe(true);
    expect(isEstimateEditable("generated")).toBe(true);
    expect(isEstimateEditable("under_review")).toBe(true);
  });

  it("freezes an estimate once it is approved or rejected", () => {
    expect(isEstimateEditable("approved")).toBe(false);
    expect(isEstimateEditable("rejected")).toBe(false);
  });
});
