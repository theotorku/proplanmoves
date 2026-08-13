import { describe, expect, it } from "vitest";
import { calculateEstimate, type EstimateCalculationInput } from "./calculate";
import { completeResidentialInput, seededPricingRules } from "./test-fixtures";

const rules = seededPricingRules;

function estimate(overrides: Partial<EstimateCalculationInput> = {}) {
  return calculateEstimate({ ...completeResidentialInput, ...overrides }, rules);
}

function totalFor(result: ReturnType<typeof estimate>, code: string) {
  return result.lineItems.find((item) => item.code === code)?.totalAmountCents ?? null;
}

describe("calculateEstimate — recommendations", () => {
  it("recommends crew, trucks, and duration from the pricing table", () => {
    const result = estimate();

    expect(result.crewSize).toBe(3);
    expect(result.truckCount).toBe(1);
    expect(result.movingMinutes).toBe(240);
    expect(result.packingMinutes).toBe(0);
    expect(result.estimatedMinutes).toBe(240);
    expect(result.travelAllowanceMinutes).toBe(30);
  });

  it("scales duration by move type", () => {
    expect(estimate({ moveType: "office" }).movingMinutes).toBe(300);
    expect(estimate({ moveType: "apartment" }).movingMinutes).toBe(270);
  });

  it("adds a truck for every configured bedroom block and warns above two", () => {
    const large = estimate({ bedroomCount: 7 });

    expect(large.crewSize).toBe(4);
    expect(large.truckCount).toBe(3);
    expect(large.movingMinutes).toBe(600);
    expect(large.warnings).toContainEqual(expect.stringContaining("above the pricing table"));
    expect(large.warnings).toContainEqual(expect.stringContaining("More than two trucks"));
  });

  it("warns when the job cannot fit in one crew day", () => {
    const result = estimate({ bedroomCount: 3, needsPacking: true, estimatedBoxes: null });

    expect(result.estimatedMinutes).toBe(630);
    expect(result.warnings).toContainEqual(expect.stringContaining("exceeds a single crew day"));
  });
});

describe("calculateEstimate — minimums and access", () => {
  it("enforces the minimum billable duration on short jobs", () => {
    const result = estimate({ bedroomCount: 0, moveType: "labor_only" });

    expect(result.movingMinutes).toBe(rules.minimumBillableMinutes);
    expect(result.truckCount).toBe(1);
    expect(totalFor(result, "moving_labor")).toBe(47700);
  });

  it("rounds billable time up to the billing increment", () => {
    const result = estimate({ bedroomCount: 1, originFloor: 1, originHasElevator: false });

    // 180 base + 30 stair minutes already lands on the increment.
    expect(result.movingMinutes).toBe(210);
    // 180 base + a 20-minute elevator allowance rounds up from 200.
    expect(
      estimate({ bedroomCount: 1, originFloor: 2, originHasElevator: true }).movingMinutes
    ).toBe(210);
  });

  it("charges stair minutes per floor and a flat elevator allowance", () => {
    const result = estimate({
      bedroomCount: 1,
      originFloor: 3,
      originHasElevator: false,
      destinationFloor: 2,
      destinationHasElevator: true
    });

    expect(result.movingMinutes).toBe(300);
    expect(result.crewSize).toBe(2);
    expect(totalFor(result, "moving_labor")).toBe(79500);
    expect(result.confidence).toBe("high");
  });

  it("assumes stairs when elevator access is unknown", () => {
    const result = estimate({ bedroomCount: 1, originFloor: 2, originHasElevator: null });

    expect(result.movingMinutes).toBe(240);
    expect(result.assumptions).toContainEqual(expect.stringContaining("elevator access is unknown"));
  });
});

describe("calculateEstimate — surcharges and totals", () => {
  it("prices a fully specified move deterministically", () => {
    const result = estimate();

    expect(totalFor(result, "moving_labor")).toBe(87600);
    expect(totalFor(result, "truck")).toBe(7500);
    expect(totalFor(result, "travel")).toBe(4500);
    expect(totalFor(result, "fuel")).toBe(3500);
    expect(result.subtotalCents).toBe(103100);
    expect(result.lowTotalCents).toBe(103100);
    expect(result.highTotalCents).toBe(118565);
  });

  it("keeps the subtotal equal to the sum of its line items", () => {
    const result = estimate({
      bedroomCount: 4,
      needsPacking: true,
      needsStorage: true,
      estimatedBoxes: 60,
      specialtyItems: ["piano"],
      requestedMoveDate: "2026-09-19"
    });

    expect(result.subtotalCents).toBe(
      result.lineItems.reduce((total, item) => total + item.totalAmountCents, 0)
    );
    expect(result.lowTotalCents).toBeLessThanOrEqual(result.highTotalCents);
    expect(result.lineItems.map((item) => item.sortOrder)).toEqual(
      result.lineItems.map((_item, index) => index)
    );
  });

  it("adds the weekend adjustment only for Saturday and Sunday", () => {
    expect(totalFor(estimate({ requestedMoveDate: "2026-09-19" }), "weekend")).toBe(12500);
    expect(totalFor(estimate({ requestedMoveDate: "2026-09-20" }), "weekend")).toBe(12500);
    expect(totalFor(estimate({ requestedMoveDate: "2026-09-16" }), "weekend")).toBeNull();
  });

  it("prices packing labor and materials separately", () => {
    const result = estimate({ needsPacking: true, estimatedBoxes: 40 });

    expect(result.packingMinutes).toBe(240);
    expect(totalFor(result, "packing_labor")).toBe(26000);
    expect(totalFor(result, "packing_materials")).toBe(14000);
  });

  it("charges configured specialty items and flags unknown ones", () => {
    const result = estimate({ specialtyItems: ["Piano", "piano", "Hot Tub"] });

    expect(totalFor(result, "specialty_piano")).toBe(25000);
    expect(result.lineItems.filter((item) => item.code === "specialty_piano")).toHaveLength(1);
    expect(result.warnings).toContainEqual(expect.stringContaining('"hot_tub"'));
  });

  it("charges storage handling and asks for a warehouse confirmation", () => {
    const result = estimate({ needsStorage: true });

    expect(totalFor(result, "storage_handling")).toBe(9500);
    expect(result.warnings).toContainEqual(expect.stringContaining("warehouse hold"));
  });
});

describe("calculateEstimate — confidence, assumptions, warnings", () => {
  it("reports high confidence and no assumptions for a complete request", () => {
    const result = estimate();

    expect(result.assumptions).toEqual([]);
    expect(result.confidence).toBe("high");
  });

  it("drops to medium confidence and widens the range for one assumption", () => {
    const result = estimate({ requestedMoveDate: null });

    expect(result.assumptions).toEqual(["No move date was provided; weekday pricing was applied."]);
    expect(result.confidence).toBe("medium");
    expect(result.highTotalCents).toBe(Math.round(result.subtotalCents * 1.25));
  });

  it("drops to low confidence when the request is mostly unknown", () => {
    const result = estimate({
      bedroomCount: null,
      estimatedBoxes: null,
      needsPacking: true,
      originFloor: null,
      destinationFloor: null,
      requestedMoveDate: null
    });

    expect(result.assumptions).toHaveLength(5);
    expect(result.confidence).toBe("low");
    expect(result.crewSize).toBe(3);
    expect(result.boxCount).toBe(30);
    expect(result.subtotalCents).toBe(133100);
    expect(result.highTotalCents).toBe(179685);
  });

  it("flags a move date that has already passed", () => {
    const result = estimate({ requestedMoveDate: "2026-07-01", today: "2026-08-12" });

    expect(result.warnings).toContainEqual(expect.stringContaining("already passed"));
  });

  it("ignores an unreadable move date instead of pricing it", () => {
    const result = estimate({ requestedMoveDate: "not-a-date" });

    expect(totalFor(result, "weekend")).toBeNull();
    expect(result.warnings).toContainEqual(expect.stringContaining("could not be read"));
  });

  it("produces identical output for identical input", () => {
    expect(estimate()).toEqual(estimate());
  });
});
