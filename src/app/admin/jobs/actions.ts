"use server";

import { revalidatePath } from "next/cache";
import { requireUserWithRoles } from "@/domains/auth/server";
import {
  createJobFromQuote,
  getJob,
  scheduleJob,
  transitionJobStatus,
  updateJobRequirements
} from "@/domains/jobs/service";
import { jobStatusSchema } from "@/domains/jobs/status";

export type JobActionState = {
  message?: string;
};

export async function createJobAction(
  _previousState: JobActionState,
  formData: FormData
): Promise<JobActionState> {
  await requireUserWithRoles(["owner", "admin", "dispatcher"]);
  const quoteId = String(formData.get("quoteId") ?? "");

  if (!quoteId) {
    return { message: "A valid quote is required." };
  }

  const result = await createJobFromQuote({ quoteId });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/quotes/${quoteId}`);
  revalidatePath("/admin/jobs");

  return {
    message: result.created
      ? `Job ${result.reference} created.`
      : `This quote is already booked as ${result.reference}.`
  };
}

export async function scheduleJobAction(
  _previousState: JobActionState,
  formData: FormData
): Promise<JobActionState> {
  await requireUserWithRoles(["owner", "admin", "dispatcher"]);
  const jobId = String(formData.get("jobId") ?? "");
  const scheduledDate = String(formData.get("scheduledDate") ?? "").trim();
  const arrivalWindowStart = String(formData.get("arrivalWindowStart") ?? "").trim();
  const arrivalWindowEnd = String(formData.get("arrivalWindowEnd") ?? "").trim();

  if (!jobId) {
    return { message: "A valid job is required." };
  }

  const result = await scheduleJob({
    jobId,
    scheduledDate,
    arrivalWindowStart,
    arrivalWindowEnd
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
  return { message: "Schedule updated." };
}

export async function updateJobRequirementsAction(
  _previousState: JobActionState,
  formData: FormData
): Promise<JobActionState> {
  await requireUserWithRoles(["owner", "admin", "dispatcher"]);
  const jobId = String(formData.get("jobId") ?? "");
  const crewSize = Number(formData.get("crewSize"));
  const truckCount = Number(formData.get("truckCount"));
  const durationHours = Number(formData.get("durationHours"));
  const operationalNotes = String(formData.get("operationalNotes") ?? "").trim();

  if (!jobId) {
    return { message: "A valid job is required." };
  }

  if (![crewSize, truckCount, durationHours].every(Number.isFinite)) {
    return { message: "Crew, trucks, and duration must be numbers." };
  }

  const result = await updateJobRequirements({
    jobId,
    crewSize,
    truckCount,
    estimatedDurationMinutes: Math.round(durationHours * 60),
    operationalNotes: operationalNotes || null
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  return { message: "Crew and truck requirements updated." };
}

export async function transitionJobAction(
  _previousState: JobActionState,
  formData: FormData
): Promise<JobActionState> {
  const { roles } = await requireUserWithRoles(["owner", "admin", "dispatcher"]);
  const jobId = String(formData.get("jobId") ?? "");
  const expectedStatus = jobStatusSchema.safeParse(formData.get("expectedStatus"));
  const nextStatus = jobStatusSchema.safeParse(formData.get("nextStatus"));
  const reason = String(formData.get("reason") ?? "");

  if (!jobId || !expectedStatus.success || !nextStatus.success) {
    return { message: "A valid job and decision are required." };
  }

  // Whether the job actually has a date comes from the stored row, not the form.
  const job = await getJob(jobId);

  if (!job) {
    return { message: "The job could not be found." };
  }

  const result = await transitionJobStatus({
    jobId,
    expectedStatus: expectedStatus.data,
    nextStatus: nextStatus.data,
    reason,
    hasSchedule: Boolean(job.scheduledDate),
    actorRoles: roles
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/leads/${job.leadId}`);
  return { message: `Job moved to ${nextStatus.data.replace("_", " ")}.` };
}
