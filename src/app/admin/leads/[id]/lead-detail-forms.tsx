"use client";

import { useActionState } from "react";
import { addLeadNoteAction, updateLeadStatusAction, type LeadActionState } from "../actions";

const initialState: LeadActionState = {};

export function LeadStatusForm({ leadId, currentStatus }: { leadId: string; currentStatus: string }) {
  const [state, formAction, isPending] = useActionState(updateLeadStatusAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="leadId" type="hidden" value={leadId} />
      <label>
        <span className="text-sm font-medium">Status</span>
        <select
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          defaultValue={currentStatus}
          name="status"
        >
          <option value="new">New</option>
          <option value="contacting">Contacting</option>
          <option value="qualified">Qualified</option>
          <option value="estimate_pending">Estimate pending</option>
          <option value="quote_pending">Quote pending</option>
          <option value="won">Won</option>
          <option value="unresponsive">Unresponsive</option>
          <option value="disqualified">Disqualified</option>
          <option value="lost">Lost</option>
        </select>
      </label>
      <label>
        <span className="text-sm font-medium">Reason</span>
        <input
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          name="reason"
          placeholder="Required for lost or disqualified"
        />
      </label>
      {state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null}
      <button className="w-fit rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={isPending} type="submit">
        {isPending ? "Updating..." : "Update status"}
      </button>
    </form>
  );
}

export function LeadNoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, isPending] = useActionState(addLeadNoteAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="leadId" type="hidden" value={leadId} />
      <label>
        <span className="text-sm font-medium">Staff note</span>
        <textarea
          className="mt-1 min-h-28 w-full rounded-md border border-neutral-300 px-3 py-2"
          maxLength={4000}
          name="body"
          required
        />
      </label>
      {state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null}
      <button className="w-fit rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium disabled:opacity-60" disabled={isPending} type="submit">
        {isPending ? "Adding..." : "Add note"}
      </button>
    </form>
  );
}
