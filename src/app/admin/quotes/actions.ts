"use server";

import { revalidatePath } from "next/cache";
import { requireUserWithRoles } from "@/domains/auth/server";
import {
  createQuoteFromEstimate,
  getQuote,
  transitionQuoteStatus,
  updateQuoteLineItem,
  updateQuoteTerms
} from "@/domains/quotes/service";
import { quoteStatusSchema } from "@/domains/quotes/status";

export type QuoteActionState = {
  message?: string;
};

export async function createQuoteAction(
  _previousState: QuoteActionState,
  formData: FormData
): Promise<QuoteActionState> {
  await requireUserWithRoles(["owner", "admin", "estimator"]);
  const estimateId = String(formData.get("estimateId") ?? "");
  const leadId = String(formData.get("leadId") ?? "");

  if (!estimateId) {
    return { message: "A valid estimate is required." };
  }

  const result = await createQuoteFromEstimate({ estimateId });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  return { message: `Quote ${result.reference} created.` };
}

export async function updateQuoteLineItemAction(
  _previousState: QuoteActionState,
  formData: FormData
): Promise<QuoteActionState> {
  await requireUserWithRoles(["owner", "admin", "estimator"]);
  const quoteId = String(formData.get("quoteId") ?? "");
  const lineItemId = String(formData.get("lineItemId") ?? "");
  const quantity = Number(formData.get("quantity"));
  const unitAmount = Number(formData.get("unitAmount"));

  if (!quoteId || !lineItemId) {
    return { message: "A valid line item is required." };
  }

  if (!Number.isFinite(quantity) || !Number.isFinite(unitAmount)) {
    return { message: "Quantity and unit price must be numbers." };
  }

  const result = await updateQuoteLineItem({
    lineItemId,
    quantity,
    unitAmountCents: Math.round(unitAmount * 100)
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/quotes/${quoteId}`);
  return { message: "Line item updated." };
}

export async function updateQuoteTermsAction(
  _previousState: QuoteActionState,
  formData: FormData
): Promise<QuoteActionState> {
  await requireUserWithRoles(["owner", "admin", "estimator"]);
  const quoteId = String(formData.get("quoteId") ?? "");
  const discount = Number(formData.get("discount"));
  const tax = Number(formData.get("tax"));
  const deposit = Number(formData.get("deposit"));
  const expiresOn = String(formData.get("expiresOn") ?? "").trim();
  const customerNotes = String(formData.get("customerNotes") ?? "").trim();

  if (!quoteId) {
    return { message: "A valid quote is required." };
  }

  if (![discount, tax, deposit].every(Number.isFinite)) {
    return { message: "Discount, tax, and deposit must be numbers." };
  }

  const result = await updateQuoteTerms({
    quoteId,
    discountCents: Math.round(discount * 100),
    taxCents: Math.round(tax * 100),
    depositCents: Math.round(deposit * 100),
    expiresOn: expiresOn || null,
    customerNotes: customerNotes || null
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/quotes/${quoteId}`);
  return { message: "Quote terms updated." };
}

export async function transitionQuoteAction(
  _previousState: QuoteActionState,
  formData: FormData
): Promise<QuoteActionState> {
  const { roles } = await requireUserWithRoles(["owner", "admin", "estimator"]);
  const quoteId = String(formData.get("quoteId") ?? "");
  const expectedStatus = quoteStatusSchema.safeParse(formData.get("expectedStatus"));
  const nextStatus = quoteStatusSchema.safeParse(formData.get("nextStatus"));
  const reason = String(formData.get("reason") ?? "");

  if (!quoteId || !expectedStatus.success || !nextStatus.success) {
    return { message: "A valid quote and decision are required." };
  }

  // The expiry date comes from the stored quote rather than the form, so a
  // client cannot talk the pre-check into expiring a live quote.
  const quote = await getQuote(quoteId);

  if (!quote) {
    return { message: "The quote could not be found." };
  }

  const result = await transitionQuoteStatus({
    quoteId,
    expectedStatus: expectedStatus.data,
    nextStatus: nextStatus.data,
    reason,
    expiresOn: quote.expiresOn,
    actorRoles: roles,
    today: new Date().toISOString().slice(0, 10)
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/quotes/${quoteId}`);
  revalidatePath(`/admin/leads/${quote.leadId}`);
  return { message: `Quote moved to ${nextStatus.data}.` };
}
