"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createJobAction, type JobActionState } from "@/app/admin/jobs/actions";
import type { JobSummary } from "@/domains/jobs/service";

const initialState: JobActionState = {};

export function JobPanel({
  quoteId,
  quoteStatus,
  job,
  canDispatch
}: {
  quoteId: string;
  quoteStatus: string;
  job: JobSummary | null;
  canDispatch: boolean;
}) {
  const [state, formAction, isPending] = useActionState(createJobAction, initialState);

  return (
    <div className="rounded-md border border-neutral-300 bg-white p-4">
      <h2 className="font-semibold">Job</h2>

      {job ? (
        <div className="mt-3 grid gap-1 text-sm">
          <Link className="font-mono text-teal-700" href={`/admin/jobs/${job.id}`}>
            {job.reference}
          </Link>
          <p className="text-neutral-700">{job.status.replace("_", " ")}</p>
          <p className="text-neutral-600">
            {job.scheduledDate
              ? `${job.scheduledDate}, ${job.arrivalWindowStart} – ${job.arrivalWindowEnd}`
              : "Not scheduled yet"}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-600">
          {quoteStatus === "accepted"
            ? "This quote is accepted and ready to book."
            : "A job is created once the customer accepts this quote."}
        </p>
      )}

      {canDispatch && !job && quoteStatus === "accepted" ? (
        <form action={formAction} className="mt-4 grid gap-2 border-t border-neutral-200 pt-4">
          <input name="quoteId" type="hidden" value={quoteId} />
          {state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null}
          <button
            className="w-fit rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Booking..." : "Book the job"}
          </button>
          <p className="text-xs text-neutral-600">
            Booking closes the lead as won. Add the date and arrival window on the job.
          </p>
        </form>
      ) : null}
    </div>
  );
}
