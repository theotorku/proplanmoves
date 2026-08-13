import { describe, expect, it } from "vitest";
import { canTransitionLeadStatus } from "./status";

describe("lead status transitions", () => {
  it("allows ordinary qualification flow", () => {
    expect(canTransitionLeadStatus("new", "contacting", ["estimator"])).toEqual({
      allowed: true
    });
    expect(canTransitionLeadStatus("contacting", "qualified", ["estimator"])).toEqual({
      allowed: true
    });
  });

  it("rejects invalid jumps", () => {
    expect(canTransitionLeadStatus("new", "won", ["estimator"])).toEqual({
      allowed: false,
      reason: "Cannot move a lead from new to won."
    });
  });

  it("requires a reason for lost and disqualified outcomes", () => {
    expect(canTransitionLeadStatus("contacting", "lost", ["estimator"])).toEqual({
      allowed: false,
      reason: "A reason is required for lost or disqualified leads."
    });
  });

  it("limits terminal lead reopening to owner or admin", () => {
    expect(canTransitionLeadStatus("lost", "contacting", ["estimator"], "Back")).toEqual({
      allowed: false,
      reason: "Only owner or admin can reopen a terminal lead."
    });
    expect(canTransitionLeadStatus("lost", "contacting", ["admin"], "Back")).toEqual({
      allowed: true
    });
  });
});
