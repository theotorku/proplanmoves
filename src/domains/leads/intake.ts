import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const moveTypes = [
  "residential",
  "apartment",
  "office",
  "labor_only",
  "packing_service"
] as const;

export const contactMethods = ["email", "phone", "sms"] as const;

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const optionalInteger = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : value),
  z.coerce.number().int().optional()
);

const addressSchema = z.object({
  line1: z.string().trim().min(3).max(160),
  line2: optionalString,
  city: z.string().trim().min(2).max(80),
  state: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  postalCode: z.string().trim().min(5).max(12),
  accessNotes: optionalString
});

export const publicLeadIntakeSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: optionalString.pipe(z.string().email().optional()),
    phone: optionalString.pipe(z.string().min(7).max(30).optional()),
    preferredContactMethod: z.enum(contactMethods).default("email"),
    marketingConsent: z.coerce.boolean().default(false),
    moveType: z.enum(moveTypes),
    requestedMoveDate: optionalString.pipe(z.string().date().optional()),
    flexibleMoveDate: z.coerce.boolean().default(false),
    bedroomCount: optionalInteger.pipe(z.number().min(0).max(10).optional()),
    originFloor: optionalInteger.pipe(z.number().min(0).max(100).optional()),
    destinationFloor: optionalInteger.pipe(z.number().min(0).max(100).optional()),
    originHasElevator: z.coerce.boolean().optional(),
    destinationHasElevator: z.coerce.boolean().optional(),
    needsPacking: z.coerce.boolean().default(false),
    needsStorage: z.coerce.boolean().default(false),
    estimatedBoxes: optionalInteger.pipe(z.number().min(0).max(1000).optional()),
    specialtyItems: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
    notes: optionalString,
    originAddress: addressSchema,
    destinationAddress: addressSchema
  })
  .superRefine((data, context) => {
    if (!data.email && !data.phone) {
      context.addIssue({
        code: "custom",
        message: "Provide either an email address or phone number.",
        path: ["email"]
      });
    }

    if (data.preferredContactMethod === "email" && !data.email) {
      context.addIssue({
        code: "custom",
        message: "Email is required when email is the preferred contact method.",
        path: ["preferredContactMethod"]
      });
    }

    if (
      (data.preferredContactMethod === "phone" || data.preferredContactMethod === "sms") &&
      !data.phone
    ) {
      context.addIssue({
        code: "custom",
        message: "Phone is required for phone or SMS contact.",
        path: ["preferredContactMethod"]
      });
    }
  });

export type PublicLeadIntakeInput = z.infer<typeof publicLeadIntakeSchema>;

export type LeadIntakeConfirmation = {
  leadReference: string;
  customerReference: string;
  dedupedCustomer: boolean;
};

export type LeadIntakeResult =
  | { ok: true; confirmation: LeadIntakeConfirmation }
  | {
      ok: false;
      error: "VALIDATION_ERROR" | "INTERNAL_ERROR";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export type LeadIntakeRepository = {
  submit(input: PublicLeadIntakeInput): Promise<LeadIntakeConfirmation>;
};

export function normalizeEmail(email: string | undefined) {
  return email?.trim().toLowerCase();
}

export function normalizePhone(phone: string | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length > 0 ? digits : undefined;
}

export async function submitPublicLeadIntake(
  rawInput: unknown,
  repository: LeadIntakeRepository = createSupabaseLeadIntakeRepository()
): Promise<LeadIntakeResult> {
  const parsed = publicLeadIntakeSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Please correct the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors
    };
  }

  try {
    const confirmation = await repository.submit({
      ...parsed.data,
      email: normalizeEmail(parsed.data.email),
      phone: normalizePhone(parsed.data.phone)
    });

    return { ok: true, confirmation };
  } catch (error) {
    return {
      ok: false,
      error: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unable to submit quote request."
    };
  }
}

function createSupabaseLeadIntakeRepository(): LeadIntakeRepository {
  return {
    async submit(input) {
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase.rpc("submit_public_lead_request", {
        payload: input
      });

      if (error) {
        throw new Error(error.message);
      }

      const confirmation = z
        .object({
          leadReference: z.string(),
          customerReference: z.string(),
          dedupedCustomer: z.boolean()
        })
        .parse(data);

      return confirmation;
    }
  };
}
