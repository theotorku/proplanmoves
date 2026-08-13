"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { QuoteSummary } from "@/domains/quotes/service";
import { createQuoteAction, type QuoteActionState } from "@/app/admin/quotes/actions";

const initialState: QuoteActionState = {};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function QuotePanel({
  leadId,
  quote,
  approvedEstimateId,
  canQuote
}: {
  leadId: string;
  quote: QuoteSummary | null;
  approvedEstimateId: string | null;
  canQuote: boolean;
}) {
  const [state, formAction, isPending] = useActionState(createQuoteAction, initialState);
  const liveQuote = quote && !["rejected", "expired", "cancelled"].includes(quote.status);

  return (
    <div className="rounded-md border border-neutral-300 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-semibold">Quote</h2>
        {quote ? (
          <span className="rounded-md border border-neutral-300 px-2 py-1 text-xs uppercase tracking-wide text-neutral-700">
            {quote.status}
          </span>
        ) : null}
      </div>

      {quote ? (
        <div className="mt-3 grid gap-2 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <Link className="font-mono text-teal-700" href={`/admin/quotes/${quote.id}`}>
              {quote.reference}
            </Link>
            <span className="text-xl font-semibold">{money.format(quote.totalCents / 100)}</span>
          </div>
          <p className="text-neutral-600">
            {quote.expiresOn ? `Valid until ${quote.expiresOn}` : "No expiry date set"}
            {quote.depositCents > 0
              ? ` · ${money.format(quote.depositCents / 100)} deposit`
              : ""}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-600">No quote has been created for this lead yet.</p>
      )}

      {canQuote && approvedEstimateId && !liveQuote ? (
        <form action={formAction} className="mt-4 grid gap-2 border-t border-neutral-200 pt-4">
          <input name="estimateId" type="hidden" value={approvedEstimateId} />
          <input name="leadId" type="hidden" value={leadId} />
          {state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null}
          <button
            className="w-fit rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Creating..." : quote ? "Create a replacement quote" : "Create quote"}
          </button>
        </form>
      ) : null}

      {canQuote && !approvedEstimateId && !quote ? (
        <p className="mt-4 border-t border-neutral-200 pt-4 text-sm text-neutral-600">
          Approve an estimate before creating a quote.
        </p>
      ) : null}
    </div>
  );
}
