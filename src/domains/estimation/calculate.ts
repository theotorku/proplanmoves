import {
  bedroomTierKey,
  type CrewSize,
  type MoveType,
  type PricingRules
} from "./pricing-rules";

export type EstimateConfidence = "high" | "medium" | "low";

export type EstimateCalculationInput = {
  moveType: MoveType;
  bedroomCount: number | null;
  estimatedBoxes: number | null;
  needsPacking: boolean;
  needsStorage: boolean;
  originFloor: number | null;
  destinationFloor: number | null;
  originHasElevator: boolean | null;
  destinationHasElevator: boolean | null;
  specialtyItems: readonly string[];
  /** ISO calendar date (YYYY-MM-DD) or null when the customer is flexible. */
  requestedMoveDate: string | null;
  /** ISO calendar date used to detect past move dates. Supplied by the caller so results stay reproducible. */
  today?: string | null;
};

export type EstimateLineItem = {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitAmountCents: number;
  totalAmountCents: number;
  category: "labor" | "packing" | "transport" | "surcharge";
  sortOrder: number;
};

export type EstimateCalculation = {
  crewSize: CrewSize;
  truckCount: number;
  /** Billable on-site minutes: moving plus packing. */
  estimatedMinutes: number;
  movingMinutes: number;
  packingMinutes: number;
  travelAllowanceMinutes: number;
  boxCount: number;
  lineItems: EstimateLineItem[];
  subtotalCents: number;
  lowTotalCents: number;
  highTotalCents: number;
  confidence: EstimateConfidence;
  assumptions: string[];
  warnings: string[];
};

/**
 * Deterministic, rules-driven estimate (ADR-003). The same input and pricing
 * rule version must always produce the same numbers, so nothing here reads the
 * clock, the environment, or a random source.
 */
export function calculateEstimate(
  input: EstimateCalculationInput,
  rules: PricingRules
): EstimateCalculation {
  const assumptions: string[] = [];
  const warnings: string[] = [];

  const bedroomCount = resolveBedroomCount(input, rules, assumptions, warnings);
  const tier = bedroomTierKey(bedroomCount);
  const crewSize = rules.crewSizeByBedroomCount[tier];
  const truckCount = Math.max(1, Math.ceil(bedroomCount / rules.bedroomsPerTruck));

  const baseMinutes =
    rules.baseMinutesByBedroomCount[tier] * rules.moveTypeMinuteMultipliers[input.moveType];
  const accessMinutes =
    accessAdjustmentMinutes("Origin", input.originFloor, input.originHasElevator, rules, assumptions) +
    accessAdjustmentMinutes(
      "Destination",
      input.destinationFloor,
      input.destinationHasElevator,
      rules,
      assumptions
    );

  const movingMinutes = roundUpToIncrement(
    Math.max(Math.round(baseMinutes + accessMinutes), rules.minimumBillableMinutes),
    rules.billingIncrementMinutes
  );

  const boxCount = resolveBoxCount(input, rules, bedroomCount, assumptions);
  const packingMinutes = input.needsPacking
    ? roundUpToIncrement(boxCount * rules.packingMinutesPerBox, rules.billingIncrementMinutes)
    : 0;

  const lineItems: EstimateLineItem[] = [];
  let sortOrder = 0;
  const addLineItem = (item: Omit<EstimateLineItem, "sortOrder">) => {
    lineItems.push({ ...item, sortOrder: sortOrder++ });
  };

  const movingHours = minutesToHours(movingMinutes);
  const hourlyRateCents = rules.hourlyRatesByCrewSize[String(crewSize) as "2" | "3" | "4"];
  addLineItem({
    code: "moving_labor",
    description: `Moving labor, ${crewSize}-person crew`,
    quantity: movingHours,
    unit: "hour",
    unitAmountCents: hourlyRateCents,
    totalAmountCents: Math.round(movingHours * hourlyRateCents),
    category: "labor"
  });

  if (packingMinutes > 0) {
    const packingHours = minutesToHours(packingMinutes);
    addLineItem({
      code: "packing_labor",
      description: "Packing labor",
      quantity: packingHours,
      unit: "hour",
      unitAmountCents: rules.packingLaborRateCents,
      totalAmountCents: Math.round(packingHours * rules.packingLaborRateCents),
      category: "packing"
    });
  }

  if (input.needsPacking && boxCount > 0) {
    addLineItem({
      code: "packing_materials",
      description: "Packing materials",
      quantity: boxCount,
      unit: "box",
      unitAmountCents: rules.boxAllowanceCents,
      totalAmountCents: boxCount * rules.boxAllowanceCents,
      category: "packing"
    });
  }

  addLineItem({
    code: "truck",
    description: "Truck fee",
    quantity: truckCount,
    unit: "truck",
    unitAmountCents: rules.truckFeeCents,
    totalAmountCents: truckCount * rules.truckFeeCents,
    category: "transport"
  });

  addLineItem({
    code: "travel",
    description: "Travel time and dispatch",
    quantity: 1,
    unit: "job",
    unitAmountCents: rules.travelBaseFeeCents,
    totalAmountCents: rules.travelBaseFeeCents,
    category: "transport"
  });

  addLineItem({
    code: "fuel",
    description: "Fuel surcharge",
    quantity: 1,
    unit: "job",
    unitAmountCents: rules.fuelSurchargeCents,
    totalAmountCents: rules.fuelSurchargeCents,
    category: "transport"
  });

  for (const item of normalizeSpecialtyItems(input.specialtyItems)) {
    const surchargeCents = rules.specialtyItemSurcharges[item];

    if (surchargeCents === undefined) {
      warnings.push(`Specialty item "${item}" has no configured surcharge and must be priced manually.`);
      continue;
    }

    addLineItem({
      code: `specialty_${item}`,
      description: `Specialty item handling: ${item.replace(/_/g, " ")}`,
      quantity: 1,
      unit: "item",
      unitAmountCents: surchargeCents,
      totalAmountCents: surchargeCents,
      category: "surcharge"
    });
  }

  if (input.needsStorage) {
    addLineItem({
      code: "storage_handling",
      description: "Storage handling",
      quantity: 1,
      unit: "job",
      unitAmountCents: rules.storageHandlingCents,
      totalAmountCents: rules.storageHandlingCents,
      category: "surcharge"
    });
    warnings.push("Storage requires a warehouse hold; confirm capacity and the monthly storage rate.");
  }

  const moveDate = parseCalendarDate(input.requestedMoveDate);

  if (input.requestedMoveDate && !moveDate) {
    warnings.push("The requested move date could not be read and was ignored.");
  }

  if (!input.requestedMoveDate) {
    assumptions.push("No move date was provided; weekday pricing was applied.");
  } else if (moveDate && isWeekend(moveDate)) {
    addLineItem({
      code: "weekend",
      description: "Weekend scheduling adjustment",
      quantity: 1,
      unit: "job",
      unitAmountCents: rules.weekendAdjustmentCents,
      totalAmountCents: rules.weekendAdjustmentCents,
      category: "surcharge"
    });
  }

  const today = parseCalendarDate(input.today ?? null);

  if (moveDate && today && moveDate < today) {
    warnings.push("The requested move date has already passed and needs to be reconfirmed.");
  }

  const estimatedMinutes = movingMinutes + packingMinutes;

  if (estimatedMinutes > rules.longJobWarningMinutes) {
    warnings.push(
      "The estimated duration exceeds a single crew day; plan a larger crew or a multi-day job."
    );
  }

  if (truckCount > 2) {
    warnings.push("More than two trucks are required; confirm fleet availability with dispatch.");
  }

  const subtotalCents = lineItems.reduce((total, item) => total + item.totalAmountCents, 0);
  const confidence = resolveConfidence(assumptions.length);
  const marginPercent =
    rules.uncertaintyMarginPercent + rules.confidenceMarginPercent[confidence];

  return {
    crewSize,
    truckCount,
    estimatedMinutes,
    movingMinutes,
    packingMinutes,
    travelAllowanceMinutes: rules.travelAllowanceMinutes,
    boxCount: input.needsPacking ? boxCount : 0,
    lineItems,
    subtotalCents,
    lowTotalCents: subtotalCents,
    highTotalCents: Math.round(subtotalCents * (1 + marginPercent / 100)),
    confidence,
    assumptions,
    warnings
  };
}

function resolveBedroomCount(
  input: EstimateCalculationInput,
  rules: PricingRules,
  assumptions: string[],
  warnings: string[]
): number {
  if (input.bedroomCount === null) {
    assumptions.push(
      `Bedroom count was not provided; ${rules.assumedBedroomCount} bedrooms were assumed.`
    );
    return rules.assumedBedroomCount;
  }

  const maxTier = Number(bedroomTierKey(Number.POSITIVE_INFINITY));

  if (input.bedroomCount > maxTier) {
    warnings.push(
      `A ${input.bedroomCount}-bedroom move is above the pricing table and was priced as ${maxTier} bedrooms; review it manually.`
    );
  }

  return input.bedroomCount;
}

function resolveBoxCount(
  input: EstimateCalculationInput,
  rules: PricingRules,
  bedroomCount: number,
  assumptions: string[]
): number {
  if (input.estimatedBoxes !== null) {
    return input.estimatedBoxes;
  }

  const assumed = Math.max(bedroomCount, 1) * rules.boxesPerBedroom;

  if (input.needsPacking) {
    assumptions.push(`Box count was not provided; ${assumed} boxes were assumed for packing.`);
  }

  return assumed;
}

function accessAdjustmentMinutes(
  label: string,
  floor: number | null,
  hasElevator: boolean | null,
  rules: PricingRules,
  assumptions: string[]
): number {
  if (floor === null) {
    assumptions.push(`${label} floor was not provided; ground-floor access was assumed.`);
    return 0;
  }

  if (floor <= 0) {
    return 0;
  }

  if (hasElevator === true) {
    return rules.elevatorAdjustmentMinutes;
  }

  if (hasElevator === null) {
    assumptions.push(`${label} elevator access is unknown; stair carrying was assumed.`);
  }

  return floor * rules.stairAdjustmentMinutesPerFloor;
}

function resolveConfidence(assumptionCount: number): EstimateConfidence {
  if (assumptionCount === 0) {
    return "high";
  }

  return assumptionCount <= 2 ? "medium" : "low";
}

function normalizeSpecialtyItems(items: readonly string[]): string[] {
  const normalized = items
    .map((item) => item.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter((item) => item.length > 0);

  return [...new Set(normalized)];
}

function roundUpToIncrement(minutes: number, increment: number): number {
  return Math.ceil(minutes / increment) * increment;
}

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

function parseCalendarDate(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isWeekend(timestamp: number): boolean {
  const day = new Date(timestamp).getUTCDay();
  return day === 0 || day === 6;
}
