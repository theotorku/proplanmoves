import type { PricingRules } from "./pricing-rules";

/**
 * Mirror of the active pricing version in `supabase/seed.sql`. A test asserts
 * the two stay identical so calculation expectations always describe the rules
 * an operator actually gets.
 */
export const seededPricingRules: PricingRules = {
  hourlyRatesByCrewSize: { "2": 15900, "3": 21900, "4": 27900 },
  minimumBillableMinutes: 180,
  billingIncrementMinutes: 15,
  baseMinutesByBedroomCount: {
    "0": 120,
    "1": 180,
    "2": 240,
    "3": 360,
    "4": 480,
    "5": 600
  },
  crewSizeByBedroomCount: {
    "0": 2,
    "1": 2,
    "2": 3,
    "3": 3,
    "4": 4,
    "5": 4
  },
  bedroomsPerTruck: 3,
  moveTypeMinuteMultipliers: {
    residential: 1,
    apartment: 1.1,
    office: 1.25,
    labor_only: 0.6,
    packing_service: 0.75
  },
  assumedBedroomCount: 2,
  boxesPerBedroom: 15,
  packingMinutesPerBox: 6,
  packingLaborRateCents: 6500,
  boxAllowanceCents: 350,
  stairAdjustmentMinutesPerFloor: 30,
  elevatorAdjustmentMinutes: 20,
  travelAllowanceMinutes: 30,
  travelBaseFeeCents: 4500,
  truckFeeCents: 7500,
  fuelSurchargeCents: 3500,
  storageHandlingCents: 9500,
  weekendAdjustmentCents: 12500,
  specialtyItemSurcharges: { piano: 25000, safe: 30000, pool_table: 35000 },
  uncertaintyMarginPercent: 15,
  confidenceMarginPercent: { high: 0, medium: 10, low: 20 },
  longJobWarningMinutes: 600
};

/** A fully specified move: no assumptions, so confidence stays high. */
export const completeResidentialInput = {
  moveType: "residential" as const,
  bedroomCount: 2,
  estimatedBoxes: 30,
  needsPacking: false,
  needsStorage: false,
  originFloor: 0,
  destinationFloor: 0,
  originHasElevator: false,
  destinationHasElevator: false,
  specialtyItems: [] as string[],
  requestedMoveDate: "2026-09-16",
  today: "2026-08-12"
};
