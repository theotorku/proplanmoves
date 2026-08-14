"use client";

import { useActionState } from "react";
import type { JobSummary } from "@/domains/jobs/service";
import type { JobStatus } from "@/domains/jobs/status";
import {
  scheduleJobAction,
  transitionJobAction,
  updateJobRequirementsAction,
  type JobActionState
} from "../actions";

const initialState: JobActionState = {};

export function JobScheduleForm({ job }: { job: JobSummary }) {
  const [state, formAction, isPending] = useActionState(scheduleJobAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="jobId" type="hidden" value={job.id} />
      <label>
        <span className="text-sm font-medium">Move date</span>
        <input
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          defaultValue={job.scheduledDate ?? ""}
          name="scheduledDate"
          required
          type="date"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-sm font-medium">Arrival from</span>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            defaultValue={job.arrivalWindowStart ?? "08:00"}
            name="arrivalWindowStart"
            required
            type="time"
          />
        </label>
        <label>
          <span className="text-sm font-medium">Arrival by</span>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            defaultValue={job.arrivalWindowEnd ?? "10:00"}
            name="arrivalWindowEnd"
            required
            type="time"
          />
        </label>
      </div>
      {state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null}
      <button
        className="w-fit rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving..." : job.scheduledDate ? "Update schedule" : "Schedule job"}
      </button>
      {job.scheduledDate ? (
        <p className="text-xs text-neutral-600">
          Changing the date or window on a confirmed job returns it to scheduled, because the
          customer confirmed the old window.
        </p>
      ) : null}
    </form>
  );
}

export function JobRequirementsForm({ job }: { job: JobSummary }) {
  const [state, formAction, isPending] = useActionState(
    updateJobRequirementsAction,
    initialState
  );

  return (
    <form action={formAction} className="grid gap-3">
      <input name="jobId" type="hidden" value={job.id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="text-sm font-medium">Crew</span>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            defaultValue={job.crewSize}
            max={12}
            min={1}
            name="crewSize"
            type="number"
          />
        </label>
        <label>
          <span className="text-sm font-medium">Trucks</span>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            defaultValue={job.truckCount}
            max={6}
            min={1}
            name="truckCount"
            type="number"
          />
        </label>
        <label>
          <span className="text-sm font-medium">Hours</span>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            defaultValue={(job.estimatedDurationMinutes / 60).toFixed(2)}
            min={0.5}
            name="durationHours"
            step="0.25"
            type="number"
          />
        </label>
      </div>
      <label>
        <span className="text-sm font-medium">Crew notes</span>
        <textarea
          className="mt-1 min-h-24 w-full rounded-md border border-neutral-300 px-3 py-2"
          defaultValue={job.operationalNotes ?? ""}
          name="operationalNotes"
          placeholder="Parking, elevator reservations, access codes"
        />
      </label>
      {state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null}
      <button
        className="w-fit rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving..." : "Save requirements"}
      </button>
    </form>
  );
}

const decisionLabels: Partial<Record<JobStatus, string>> = {
  scheduled: "Put on the calendar",
  confirmed: "Customer confirmed",
  in_progress: "Crew started",
  completed: "Mark complete",
  unscheduled: "Take off the calendar",
  cancelled: "Cancel job"
};

export function JobStatusForm({
  job,
  canOverride
}: {
  job: JobSummary;
  canOverride: boolean;
}) {
  const [state, formAction, isPending] = useActionState(transitionJobAction, initialState);
  const nextStatuses = availableTransitions(job, canOverride);

  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        This job is {job.status.replace("_", " ")} and has no remaining actions.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input name="jobId" type="hidden" value={job.id} />
      <input name="expectedStatus" type="hidden" value={job.status} />
      <label>
        <span className="text-sm font-medium">Reason</span>
        <input
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          name="reason"
          placeholder="Required to cancel, or to complete a job that never started"
        />
      </label>
      {state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null}
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((status) => (
          <button
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-60"
            disabled={isPending}
            key={status}
            name="nextStatus"
            type="submit"
            value={status}
          >
            {decisionLabels[status] ?? status}
          </button>
        ))}
      </div>
    </form>
  );
}

function availableTransitions(job: JobSummary, canOverride: boolean): JobStatus[] {
  switch (job.status) {
    case "unscheduled":
      return [...(job.scheduledDate ? (["scheduled"] as const) : []), "cancelled"];
    case "scheduled":
      return [
        "confirmed",
        "in_progress",
        ...(canOverride ? (["completed"] as const) : []),
        "unscheduled",
        "cancelled"
      ];
    case "confirmed":
      return [
        "in_progress",
        ...(canOverride ? (["completed"] as const) : []),
        "scheduled",
        "cancelled"
      ];
    case "in_progress":
      return ["completed", "cancelled"];
    default:
      return [];
  }
}
