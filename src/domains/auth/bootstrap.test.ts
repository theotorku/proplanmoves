import { describe, expect, it } from "vitest";
import { bootstrapOwnerInputSchema } from "./bootstrap";

describe("bootstrap owner input", () => {
  it("requires a real Supabase auth user id and email", () => {
    expect(() =>
      bootstrapOwnerInputSchema.parse({
        userId: "not-a-uuid",
        email: "owner@example.com",
        fullName: "Owner"
      })
    ).toThrow();
  });

  it("accepts a constrained owner bootstrap request", () => {
    expect(
      bootstrapOwnerInputSchema.parse({
        userId: "00000000-0000-4000-8000-000000000000",
        email: "owner@example.com",
        fullName: "ProPlan Owner"
      })
    ).toEqual({
      userId: "00000000-0000-4000-8000-000000000000",
      email: "owner@example.com",
      fullName: "ProPlan Owner"
    });
  });
});
