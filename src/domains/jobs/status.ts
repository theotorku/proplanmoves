import { z } from "zod";
import type { RoleCode } from "@/domains/auth/roles";

export const jobStatuses = [
  "unscheduled",
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled"
] as const;

export type JobStatus = (typeof jobStatuses)[number];

export const jobStatusSchema = z.enum(jobStatuses);

const allowedTransitions: Record<JobStatus, JobStatus[]> = {
  unscheduled: ["scheduled", "cancelled"],
  scheduled: ["confirmed", "in_progress", "completed", "unscheduled", "cancelled"],
  confirmed: ["in_progress", "completed", "scheduled", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

const dispatchRoles: readonly RoleCode[] = ["owner", "admin", "dispatcher"];
const managerRoles: readonly RoleCode[] = ["owner", "admin"];

export type JobTransitionDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/** Mirrors the transition_job_status database function. */
export function canTransitionJob(params: {
  currentStatus: JobStatus;
  nextStatus: JobStatus;
  actorRoles: readonly RoleCode[];
  reason?: string;
  hasSchedule?: boolean;
}): JobTransitionDecision {
  const { currentStatus, nextStatus, actorRoles, reason } = params;

  if (!actorRoles.some((role) => dispatchRoles.includes(role))) {
    return {
      allowed: false,
      reason: "Only an owner, admin, or dispatcher can update jobs."
    };
  }

  if (currentStatus === nextStatus) {
    return { allowed: true };
  }

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    return {
      allowed: false,
      reason: `Cannot move a job from ${currentStatus} to ${nextStatus}.`
    };
  }

  if (nextStatus === "scheduled" && params.hasSchedule === false) {
    return {
      allowed: false,
      reason: "Give the job a date and arrival window before scheduling it."
    };
  }

  // Completing a job that was never started is a records correction.
  if (nextStatus === "completed" && currentStatus !== "in_progress") {
    if (!actorRoles.some((role) => managerRoles.includes(role))) {
      return {
        allowed: false,
        reason: "Only an owner or admin can complete a job that was never started."
      };
    }

    if (!reason?.trim()) {
      return {
        allowed: false,
        reason: "Completing a job that was never started requires a reason."
      };
    }
  }

  if (nextStatus === "cancelled" && !reason?.trim()) {
    return { allowed: false, reason: "Cancelling a job requires a reason." };
  }

  return { allowed: true };
}

export function isJobOpen(status: JobStatus): boolean {
  return status !== "completed" && status !== "cancelled";
}

/** Jobs that belong on the upcoming schedule board. */
export function isJobOnSchedule(status: JobStatus): boolean {
  return status === "scheduled" || status === "confirmed" || status === "in_progress";
}
