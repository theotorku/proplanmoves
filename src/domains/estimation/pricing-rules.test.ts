import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bedroomTierKey, parsePricingRules } from "./pricing-rules";
import { seededPricingRules } from "./test-fixtures";

function readSeededRulesJson(): unknown {
  const seed = readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8");
  const start = seed.indexOf("'{");
  const end = seed.indexOf("}'::jsonb");

  if (start === -1 || end === -1) {
    throw new Error("The seed file no longer contains a pricing rule version payload.");
  }

  return JSON.parse(seed.slice(start + 1, end + 1));
}

describe("pricing rules", () => {
  it("accepts the seeded active pricing version", () => {
    expect(() => parsePricingRules(readSeededRulesJson())).not.toThrow();
  });

  it("keeps the calculation fixture identical to the seeded version", () => {
    expect(readSeededRulesJson()).toEqual(seededPricingRules);
  });

  it("rejects a version that is missing a required rule", () => {
    const incomplete: Record<string, unknown> = { ...seededPricingRules };
    delete incomplete.truckFeeCents;

    expect(() => parsePricingRules(incomplete)).toThrow(/truckFeeCents/);
  });

  it("rejects negative money and fractional cents", () => {
    expect(() => parsePricingRules({ ...seededPricingRules, truckFeeCents: -1 })).toThrow();
    expect(() => parsePricingRules({ ...seededPricingRules, truckFeeCents: 75.5 })).toThrow();
  });

  it("rejects an unsupported crew size", () => {
    expect(() =>
      parsePricingRules({
        ...seededPricingRules,
        crewSizeByBedroomCount: { ...seededPricingRules.crewSizeByBedroomCount, "5": 6 }
      })
    ).toThrow();
  });

  it("clamps bedroom counts onto the configured tiers", () => {
    expect(bedroomTierKey(-2)).toBe("0");
    expect(bedroomTierKey(3)).toBe("3");
    expect(bedroomTierKey(9)).toBe("5");
  });
});
