import { describe, expect, it } from "vitest";
import { canAssignLead, leadAssigneeFilterSchema } from "./assignment";

const actor = "11111111-1111-4111-8111-111111111111";
const teammate = "22222222-2222-4222-8222-222222222222";

describe("canAssignLead", () => {
  it("rejects roles without lead ownership", () => {
    const decision = canAssignLead({
      actorRoles: ["dispatcher"],
      actorProfileId: actor,
      currentAssigneeProfileId: null,
      nextAssigneeProfileId: actor
    });

    expect(decision).toEqual({
      allowed: false,
      reason: "Only an owner, admin, or estimator can assign leads."
    });
  });

  it("lets an admin move a lead between operators", () => {
    expect(
      canAssignLead({
        actorRoles: ["admin"],
        actorProfileId: actor,
        currentAssigneeProfileId: teammate,
        nextAssigneeProfileId: actor
      })
    ).toEqual({ allowed: true });
  });

  it("lets an estimator claim an unassigned lead", () => {
    expect(
      canAssignLead({
        actorRoles: ["estimator"],
        actorProfileId: actor,
        currentAssigneeProfileId: null,
        nextAssigneeProfileId: actor
      })
    ).toEqual({ allowed: true });
  });

  it("lets an estimator release their own lead", () => {
    expect(
      canAssignLead({
        actorRoles: ["estimator"],
        actorProfileId: actor,
        currentAssigneeProfileId: actor,
        nextAssigneeProfileId: null
      })
    ).toEqual({ allowed: true });
  });

  it("stops an estimator from taking a teammate's lead", () => {
    const decision = canAssignLead({
      actorRoles: ["estimator"],
      actorProfileId: actor,
      currentAssigneeProfileId: teammate,
      nextAssigneeProfileId: actor
    });

    expect(decision.allowed).toBe(false);
  });

  it("stops an estimator from releasing a teammate's lead", () => {
    const decision = canAssignLead({
      actorRoles: ["estimator"],
      actorProfileId: actor,
      currentAssigneeProfileId: teammate,
      nextAssigneeProfileId: null
    });

    expect(decision.allowed).toBe(false);
  });

  it("stops an estimator from assigning a lead to someone else", () => {
    const decision = canAssignLead({
      actorRoles: ["estimator"],
      actorProfileId: actor,
      currentAssigneeProfileId: null,
      nextAssigneeProfileId: teammate
    });

    expect(decision.allowed).toBe(false);
  });
});

describe("leadAssigneeFilterSchema", () => {
  it("defaults to all", () => {
    expect(leadAssigneeFilterSchema.parse(undefined)).toBe("all");
  });

  it("accepts the unassigned bucket and profile identifiers", () => {
    expect(leadAssigneeFilterSchema.parse("unassigned")).toBe("unassigned");
    expect(leadAssigneeFilterSchema.parse(actor)).toBe(actor);
  });

  it("rejects arbitrary values", () => {
    expect(leadAssigneeFilterSchema.safeParse("someone").success).toBe(false);
  });
});
