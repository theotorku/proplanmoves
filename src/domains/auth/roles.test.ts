import { describe, expect, it } from "vitest";
import { hasAnyRole, hasRoleAtLeast, isRoleCode } from "./roles";

describe("auth roles", () => {
  it("accepts only known role codes", () => {
    expect(isRoleCode("admin")).toBe(true);
    expect(isRoleCode("sales")).toBe(false);
  });

  it("checks role membership", () => {
    expect(hasAnyRole(["viewer"], ["admin", "viewer"])).toBe(true);
    expect(hasAnyRole(["dispatcher"], ["admin", "estimator"])).toBe(false);
  });

  it("supports coarse hierarchy checks for server policies", () => {
    expect(hasRoleAtLeast(["admin"], "dispatcher")).toBe(true);
    expect(hasRoleAtLeast(["viewer"], "estimator")).toBe(false);
  });
});
