import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  normalizePhone,
  submitPublicLeadIntake,
  type LeadIntakeRepository,
  type PublicLeadIntakeInput
} from "./intake";

const validInput = {
  firstName: "Jordan",
  lastName: "Rivera",
  email: " Jordan@example.COM ",
  phone: "(312) 555-0199",
  preferredContactMethod: "email",
  marketingConsent: false,
  moveType: "apartment",
  requestedMoveDate: "2026-08-15",
  flexibleMoveDate: false,
  bedroomCount: 2,
  originFloor: 2,
  destinationFloor: 1,
  originHasElevator: false,
  destinationHasElevator: true,
  needsPacking: true,
  needsStorage: false,
  estimatedBoxes: 45,
  specialtyItems: ["piano"],
  notes: "Afternoon preferred.",
  originAddress: {
    line1: "100 Main St",
    city: "Chicago",
    state: "il",
    postalCode: "60601"
  },
  destinationAddress: {
    line1: "200 Lake St",
    city: "Evanston",
    state: "IL",
    postalCode: "60201"
  }
};

describe("public lead intake", () => {
  it("normalizes contact values", () => {
    expect(normalizeEmail(" TEST@Example.COM ")).toBe("test@example.com");
    expect(normalizePhone("(312) 555-0100")).toBe("3125550100");
  });

  it("rejects invalid public submissions before persistence", async () => {
    const result = await submitPublicLeadIntake({
      ...validInput,
      email: "",
      phone: "",
      preferredContactMethod: "email"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("VALIDATION_ERROR");
      expect(result.fieldErrors?.email).toContain("Provide either an email address or phone number.");
    }
  });

  it("persists a valid submission and returns confirmation references", async () => {
    const calls: PublicLeadIntakeInput[] = [];
    const repository: LeadIntakeRepository = {
      async submit(input) {
        calls.push(input);
        return {
          leadReference: "LEAD-2026-00001",
          customerReference: "CUST-ABCD1234",
          dedupedCustomer: false
        };
      }
    };

    const result = await submitPublicLeadIntake(validInput, repository);

    expect(result).toEqual({
      ok: true,
      confirmation: {
        leadReference: "LEAD-2026-00001",
        customerReference: "CUST-ABCD1234",
        dedupedCustomer: false
      }
    });
    expect(calls[0]?.email).toBe("jordan@example.com");
    expect(calls[0]?.phone).toBe("3125550199");
    expect(calls[0]?.originAddress.state).toBe("IL");
  });

  it("surfaces customer deduplication from persistence", async () => {
    const repository: LeadIntakeRepository = {
      async submit() {
        return {
          leadReference: "LEAD-2026-00002",
          customerReference: "CUST-ABCD1234",
          dedupedCustomer: true
        };
      }
    };

    const result = await submitPublicLeadIntake(validInput, repository);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.confirmation.dedupedCustomer).toBe(true);
    }
  });
});
