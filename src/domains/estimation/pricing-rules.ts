import { z } from "zod";

/**
 * The shape of `pricing_rule_versions.rules_json`. Versions are immutable once
 * an estimate references them (ADR-012), so this schema is the contract every
 * stored version must satisfy for the calculation service to run.
 */
const centsSchema = z.number().int().nonnegative();
const minutesSchema = z.number().int().nonnegative();
const crewSizeSchema = z.union([z.literal(2), z.literal(3), z.literal(4)]);
const multiplierSchema = z.number().positive().max(5);

export const moveTypes = [
  "residential",
  "apartment",
  "office",
  "labor_only",
  "packing_service"
] as const;

export type MoveType = (typeof moveTypes)[number];

export type CrewSize = z.infer<typeof crewSizeSchema>;

export const bedroomTiers = ["0", "1", "2", "3", "4", "5"] as const;

const bedroomMinutesSchema = z.object({
  "0": minutesSchema,
  "1": minutesSchema,
  "2": minutesSchema,
  "3": minutesSchema,
  "4": minutesSchema,
  "5": minutesSchema
});

const bedroomCrewSchema = z.object({
  "0": crewSizeSchema,
  "1": crewSizeSchema,
  "2": crewSizeSchema,
  "3": crewSizeSchema,
  "4": crewSizeSchema,
  "5": crewSizeSchema
});

export const pricingRulesSchema = z.object({
  hourlyRatesByCrewSize: z.object({
    "2": centsSchema,
    "3": centsSchema,
    "4": centsSchema
  }),
  minimumBillableMinutes: minutesSchema,
  billingIncrementMinutes: z.number().int().min(1).max(60),
  baseMinutesByBedroomCount: bedroomMinutesSchema,
  crewSizeByBedroomCount: bedroomCrewSchema,
  bedroomsPerTruck: z.number().int().min(1),
  moveTypeMinuteMultipliers: z.object({
    residential: multiplierSchema,
    apartment: multiplierSchema,
    office: multiplierSchema,
    labor_only: multiplierSchema,
    packing_service: multiplierSchema
  }),
  assumedBedroomCount: z.number().int().min(0).max(5),
  boxesPerBedroom: z.number().int().nonnegative(),
  packingMinutesPerBox: minutesSchema,
  packingLaborRateCents: centsSchema,
  boxAllowanceCents: centsSchema,
  stairAdjustmentMinutesPerFloor: minutesSchema,
  elevatorAdjustmentMinutes: minutesSchema,
  travelAllowanceMinutes: minutesSchema,
  travelBaseFeeCents: centsSchema,
  truckFeeCents: centsSchema,
  fuelSurchargeCents: centsSchema,
  storageHandlingCents: centsSchema,
  weekendAdjustmentCents: centsSchema,
  specialtyItemSurcharges: z.record(z.string(), centsSchema),
  uncertaintyMarginPercent: z.number().min(0).max(100),
  confidenceMarginPercent: z.object({
    high: z.number().min(0).max(100),
    medium: z.number().min(0).max(100),
    low: z.number().min(0).max(100)
  }),
  longJobWarningMinutes: minutesSchema
});

export type PricingRules = z.infer<typeof pricingRulesSchema>;

export function parsePricingRules(rulesJson: unknown): PricingRules {
  const result = pricingRulesSchema.safeParse(rulesJson);

  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `Invalid pricing rule version: ${issue.path.join(".") || "(root)"} ${issue.message}`
    );
  }

  return result.data;
}

/** Clamps a bedroom count onto the configured pricing tiers. */
export function bedroomTierKey(bedroomCount: number): (typeof bedroomTiers)[number] {
  const clamped = Math.min(Math.max(Math.trunc(bedroomCount), 0), bedroomTiers.length - 1);
  return bedroomTiers[clamped];
}
