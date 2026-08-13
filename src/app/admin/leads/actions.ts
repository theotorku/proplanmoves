"use server";

import { revalidatePath } from "next/cache";
import { requireUserWithRoles } from "@/domains/auth/server";
import { addLeadNote, updateLeadStatus } from "@/domains/leads/admin";
import { leadStatusSchema } from "@/domains/leads/status";

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
