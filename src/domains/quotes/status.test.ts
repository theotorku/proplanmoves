import { describe, expect, it } from "vitest";
import {
  canTransitionQuote,
  isPastExpiry,
  isQuoteEditable,
  isQuoteOpen,
  type QuoteStatus
} from "./status";

function decide(overrides: Parameters<typeof canTransitionQuote>[0]) {
  return canTransitionQuote(overrides);
}

describe("canTransitionQuote", () => {
  it("walks the documented happy path", () => {
    const path: [QuoteStatus, QuoteStatus][] = [
      ["draft", "ready"],
      ["ready", "sent"],
      ["sent", "viewed"],
      ["viewed", "accepted"]
    ];

    for (const [currentStatus, nextStatus] of path) {
      expect(
        decide({ currentStatus, nextStatus, actorRoles: ["estimator"] })
      ).toEqual({ allowed: true });
    }
  });

  it("only lets a ready quote be sent", () => {
    expect(
      decide({ currentStatus: "draft", nextStatus: "sent", actorRoles: ["admin"] }).allowed
    ).toBe(false);
    expect(
      decide({ currentStatus: "ready", nextStatus: "sent", actorRoles: ["admin"] }).allowed
    ).toBe(true);
  });

  it("only accepts or rejects from sent or viewed", () => {
    expect(
      decide({ currentStatus: "ready", nextStatus: "accepted", actorRoles: ["admin"] }).allowed
    ).toBe(false);
    expect(
      decide({ currentStatus: "sent", nextStatus: "accepted", actorRoles: ["admin"] }).allowed
    ).toBe(true);
    expect(
      decide({
        currentStatus: "viewed",
        nextStatus: "rejected",
        actorRoles: ["admin"],
        reason: "Chose another mover"
      }).allowed
    ).toBe(true);
  });

  it("requires a reason to record a rejection", () => {
    expect(decide({ currentStatus: "sent", nextStatus: "rejected", actorRoles: ["admin"] })).toEqual(
      { allowed: false, reason: "A reason is required to record a rejection." }
    );
  });

  it("lets a draft go back for more editing but not a sent quote", () => {
    expect(
      decide({ currentStatus: "ready", nextStatus: "draft", actorRoles: ["estimator"] }).allowed
    ).toBe(true);
    expect(
      decide({ currentStatus: "sent", nextStatus: "draft", actorRoles: ["estimator"] }).allowed
    ).toBe(false);
  });

  it("requires an owner or admin with a reason to cancel an accepted quote", () => {
    expect(
      decide({
        currentStatus: "accepted",
        nextStatus: "cancelled",
        actorRoles: ["estimator"],
        reason: "Customer moved out of area"
      })
    ).toEqual({
      allowed: false,
      reason: "Only an owner or admin can cancel an accepted quote."
    });

    expect(
      decide({ currentStatus: "accepted", nextStatus: "cancelled", actorRoles: ["owner"] })
    ).toEqual({
      allowed: false,
      reason: "Cancelling an accepted quote requires a reason."
    });

    expect(
      decide({
        currentStatus: "accepted",
        nextStatus: "cancelled",
        actorRoles: ["owner"],
        reason: "Customer moved out of area"
      })
    ).toEqual({ allowed: true });
  });

  it("expires only a quote that is actually past its date", () => {
    expect(
      decide({
        currentStatus: "sent",
        nextStatus: "expired",
        actorRoles: ["admin"],
        expiresOn: "2026-08-20",
        today: "2026-08-13"
      })
    ).toEqual({ allowed: false, reason: "This quote has not reached its expiry date." });

    expect(
      decide({
        currentStatus: "sent",
        nextStatus: "expired",
        actorRoles: ["admin"],
        expiresOn: "2026-08-12",
        today: "2026-08-13"
      })
    ).toEqual({ allowed: true });
  });

  it("treats a quote with no expiry date as never expiring on its own", () => {
    expect(
      decide({
        currentStatus: "sent",
        nextStatus: "expired",
        actorRoles: ["admin"],
        expiresOn: null,
        today: "2026-08-13"
      }).allowed
    ).toBe(false);
  });

  it("will not cancel a quote whose job is still live", () => {
    expect(
      decide({
        currentStatus: "accepted",
        nextStatus: "cancelled",
        actorRoles: ["owner"],
        reason: "Customer moved out of area",
        hasLiveJob: true
      })
    ).toEqual({
      allowed: false,
      reason: "Cancel the booked job first so dispatch and the customer record agree."
    });
  });

  it("cancels once the job has been cancelled", () => {
    expect(
      decide({
        currentStatus: "accepted",
        nextStatus: "cancelled",
        actorRoles: ["owner"],
        reason: "Customer moved out of area",
        hasLiveJob: false
      })
    ).toEqual({ allowed: true });
  });

  it("blocks cancellation from any status while a job is live", () => {
    expect(
      decide({
        currentStatus: "sent",
        nextStatus: "cancelled",
        actorRoles: ["admin"],
        hasLiveJob: true
      }).allowed
    ).toBe(false);
  });

  it("keeps rejected, expired, and cancelled quotes final", () => {
    for (const status of ["rejected", "expired", "cancelled"] as QuoteStatus[]) {
      expect(
        decide({ currentStatus: status, nextStatus: "draft", actorRoles: ["owner"] }).allowed
      ).toBe(false);
    }
  });

  it("keeps roles without quoting rights out", () => {
    expect(
      decide({ currentStatus: "draft", nextStatus: "ready", actorRoles: ["dispatcher"] }).allowed
    ).toBe(false);
    expect(
      decide({ currentStatus: "draft", nextStatus: "ready", actorRoles: ["viewer"] }).allowed
    ).toBe(false);
  });
});

describe("quote predicates", () => {
  it("allows edits only before the quote leaves the office", () => {
    expect(isQuoteEditable("draft")).toBe(true);
    expect(isQuoteEditable("ready")).toBe(true);
    expect(isQuoteEditable("sent")).toBe(false);
    expect(isQuoteEditable("accepted")).toBe(false);
  });

  it("counts every non-terminal quote as open", () => {
    expect(isQuoteOpen("sent")).toBe(true);
    expect(isQuoteOpen("accepted")).toBe(true);
    expect(isQuoteOpen("rejected")).toBe(false);
    expect(isQuoteOpen("expired")).toBe(false);
    expect(isQuoteOpen("cancelled")).toBe(false);
  });

  it("compares expiry dates as calendar days", () => {
    expect(isPastExpiry("2026-08-12", "2026-08-13")).toBe(true);
    expect(isPastExpiry("2026-08-13", "2026-08-13")).toBe(false);
    expect(isPastExpiry(null, "2026-08-13")).toBe(false);
  });
});
