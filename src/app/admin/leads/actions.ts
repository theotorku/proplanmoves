"use server";

import { revalidatePath } from "next/cache";
import { requireUserWithRoles } from "@/domains/auth/server";
import { addLeadNote, assignLead, updateLeadStatus } from "@/domains/leads/admin";
import { leadStatusSchema } from "@/domains/leads/status";
import {
  generateEstimateForLead,
  reviewEstimate,
  updateEstimateLineItem
} from "@/domains/estimation/service";
import { estimateStatusSchema } from "@/domains/estimation/status";

export type LeadActionState = {
  message?: string;
};

export async function updateLeadStatusAction(
  _previousState: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const { roles } = await requireUserWithRoles(["owner", "admin", "estimator"]);
  const leadId = String(formData.get("leadId") ?? "");
  const nextStatus = leadStatusSchema.safeParse(formData.get("status"));
  const reason = String(formData.get("reason") ?? "");

  if (!leadId || !nextStatus.success) {
    return { message: "A valid lead and status are required." };
  }

  const result = await updateLeadStatus({
    leadId,
    nextStatus: nextStatus.data,
    reason,
    actorRoles: roles
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  return { message: "Lead status updated." };
}

export async function assignLeadAction(
  _previousState: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const { user, roles } = await requireUserWithRoles(["owner", "admin", "estimator"]);
  const leadId = String(formData.get("leadId") ?? "");

  if (!leadId) {
    return { message: "A valid lead is required." };
  }

  const result = await assignLead({
    leadId,
    expectedProfileId: readProfileId(formData.get("expectedProfileId")),
    assigneeProfileId: readProfileId(formData.get("assigneeProfileId")),
    actorProfileId: user.id,
    actorRoles: roles
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  return { message: "Lead assignment updated." };
}

export async function generateEstimateAction(
  _previousState: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  await requireUserWithRoles(["owner", "admin", "estimator"]);
  const leadId = String(formData.get("leadId") ?? "");

  if (!leadId) {
    return { message: "A valid lead is required." };
  }

  const result = await generateEstimateForLead({
    leadId,
    today: new Date().toISOString().slice(0, 10)
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  return { message: `Estimate ${result.reference} generated.` };
}

export async function reviewEstimateAction(
  _previousState: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const { roles } = await requireUserWithRoles(["owner", "admin", "estimator"]);
  const leadId = String(formData.get("leadId") ?? "");
  const estimateId = String(formData.get("estimateId") ?? "");
  const expectedStatus = estimateStatusSchema.safeParse(formData.get("expectedStatus"));
  const nextStatus = estimateStatusSchema.safeParse(formData.get("nextStatus"));
  const reason = String(formData.get("reason") ?? "");

  if (!leadId || !estimateId || !expectedStatus.success || !nextStatus.success) {
    return { message: "A valid estimate and review decision are required." };
  }

  const result = await reviewEstimate({
    estimateId,
    expectedStatus: expectedStatus.data,
    nextStatus: nextStatus.data,
    reason,
    actorRoles: roles
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/leads/${leadId}`);
  return { message: `Estimate moved to ${nextStatus.data.replace("_", " ")}.` };
}

export async function updateEstimateLineItemAction(
  _previousState: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  await requireUserWithRoles(["owner", "admin", "estimator"]);
  const leadId = String(formData.get("leadId") ?? "");
  const lineItemId = String(formData.get("lineItemId") ?? "");
  const quantity = Number(formData.get("quantity"));
  const unitAmount = Number(formData.get("unitAmount"));

  if (!leadId || !lineItemId) {
    return { message: "A valid line item is required." };
  }

  if (!Number.isFinite(quantity) || !Number.isFinite(unitAmount)) {
    return { message: "Quantity and unit price must be numbers." };
  }

  const result = await updateEstimateLineItem({
    lineItemId,
    quantity,
    // Operators edit dollars; the database stores integer cents (ADR-005).
    unitAmountCents: Math.round(unitAmount * 100)
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/leads/${leadId}`);
  return { message: "Line item updated." };
}

// An empty select value means "unassigned", which the database reads as null.
function readProfileId(value: FormDataEntryValue | null): string | null {
  const profileId = String(value ?? "").trim();
  return profileId === "" ? null : profileId;
}

export async function addLeadNoteAction(
  _previousState: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  await requireUserWithRoles(["owner", "admin", "estimator", "dispatcher"]);
  const leadId = String(formData.get("leadId") ?? "");
  const body = String(formData.get("body") ?? "");

  if (!leadId) {
    return { message: "A valid lead is required." };
  }

  const result = await addLeadNote({
    leadId,
    body
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/leads/${leadId}`);
  return { message: "Note added." };
}
