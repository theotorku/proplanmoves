"use server";

import { submitPublicLeadIntake } from "@/domains/leads/intake";

export type QuoteRequestActionState = {
  message?: string;
  confirmation?: {
    leadReference: string;
    customerReference: string;
    dedupedCustomer: boolean;
  };
  fieldErrors?: Record<string, string[]>;
};

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function submitQuoteRequestAction(
  _previousState: QuoteRequestActionState,
  formData: FormData
): Promise<QuoteRequestActionState> {
  const specialtyItems = formData
    .getAll("specialtyItems")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const result = await submitPublicLeadIntake({
    firstName: stringValue(formData, "firstName"),
    lastName: stringValue(formData, "lastName"),
    email: stringValue(formData, "email"),
    phone: stringValue(formData, "phone"),
    preferredContactMethod: stringValue(formData, "preferredContactMethod"),
    marketingConsent: checkboxValue(formData, "marketingConsent"),
    moveType: stringValue(formData, "moveType"),
    requestedMoveDate: stringValue(formData, "requestedMoveDate"),
    flexibleMoveDate: checkboxValue(formData, "flexibleMoveDate"),
    bedroomCount: stringValue(formData, "bedroomCount"),
    originFloor: stringValue(formData, "originFloor"),
    destinationFloor: stringValue(formData, "destinationFloor"),
    originHasElevator: checkboxValue(formData, "originHasElevator"),
    destinationHasElevator: checkboxValue(formData, "destinationHasElevator"),
    needsPacking: checkboxValue(formData, "needsPacking"),
    needsStorage: checkboxValue(formData, "needsStorage"),
    estimatedBoxes: stringValue(formData, "estimatedBoxes"),
    specialtyItems,
    notes: stringValue(formData, "notes"),
    originAddress: {
      line1: stringValue(formData, "originLine1"),
      line2: stringValue(formData, "originLine2"),
      city: stringValue(formData, "originCity"),
      state: stringValue(formData, "originState"),
      postalCode: stringValue(formData, "originPostalCode"),
      accessNotes: stringValue(formData, "originAccessNotes")
    },
    destinationAddress: {
      line1: stringValue(formData, "destinationLine1"),
      line2: stringValue(formData, "destinationLine2"),
      city: stringValue(formData, "destinationCity"),
      state: stringValue(formData, "destinationState"),
      postalCode: stringValue(formData, "destinationPostalCode"),
      accessNotes: stringValue(formData, "destinationAccessNotes")
    }
  });

  if (!result.ok) {
    return {
      message: result.message,
      fieldErrors: result.fieldErrors
    };
  }

  return {
    message: "Quote request received.",
    confirmation: result.confirmation
  };
}
