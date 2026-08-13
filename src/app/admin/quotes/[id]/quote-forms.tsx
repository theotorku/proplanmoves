"use client";

import { useActionState } from "react";
import type { QuoteLineItem, QuoteSummary } from "@/domains/quotes/service";
import { isPastExpiry, type QuoteStatus } from "@/domains/quotes/status";
import {
  transitionQuoteAction,
  updateQuoteLineItemAction,
  updateQuoteTermsAction,
  type QuoteActionState
} from "../actions";

const initialState: QuoteActionState = {};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number) {
  return money.format(cents / 100);
}

export function QuoteLineItemsEditor({
  quote,
  editable
}: {
  quote: QuoteSummary;
  editable: boolean;
}) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead className="text-neutral-600">
        <tr>
          <th className="border-b border-neutral-200 py-2">Line</th>
          <th className="border-b border-neutral-200 py-2">Qty</th>
          <th className="border-b border-neutral-200 py-2">Unit</th>
          <th className="border-b border-neutral-200 py-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {quote.lineItems.map((item) => (
          <QuoteLineItemRow editable={editable} item={item} key={item.id} quoteId={quote.id} />
        ))}
      </tbody>
    </table>
  );
}

function QuoteLineItemRow({
  quoteId,
  item,
  editable
}: {
  quoteId: string;
  item: QuoteLineItem;
  editable: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateQuoteLineItemAction, initialState);

  if (!editable) {
    return (
      <tr>
        <td className="border-b border-neutral-200 py-2">{item.description}</td>
        <td className="border-b border-neutral-200 py-2">
          {item.quantity} {item.unit}
        </td>
        <td className="border-b border-neutral-200 py-2">{formatCents(item.unitAmountCents)}</td>
        <td className="border-b border-neutral-200 py-2 text-right">
          {formatCents(item.totalAmountCents)}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="border-b border-neutral-200 py-2">
        <label htmlFor={`quantity-${item.id}`}>{item.description}</label>
        {state.message ? (
          <span className="block text-xs text-amber-700">{state.message}</span>
        ) : null}
      </td>
      <td className="border-b border-neutral-200 py-2">
        <form action={formAction} className="flex items-center gap-2" id={`quote-line-${item.id}`}>
          <input name="quoteId" type="hidden" value={quoteId} />
          <input name="lineItemId" type="hidden" value={item.id} />
          <input
            className="w-20 rounded-md border border-neutral-300 px-2 py-1"
            defaultValue={item.quantity}
            id={`quantity-${item.id}`}
            min={0}
            name="quantity"
            step="0.01"
            type="number"
          />
          <span className="text-neutral-600">{item.unit}</span>
        </form>
      </td>
      <td className="border-b border-neutral-200 py-2">
        <input
          aria-label={`Unit price for ${item.description}`}
          className="w-24 rounded-md border border-neutral-300 px-2 py-1"
          defaultValue={(item.unitAmountCents / 100).toFixed(2)}
          form={`quote-line-${item.id}`}
          min={0}
          name="unitAmount"
          step="0.01"
          type="number"
        />
      </td>
      <td className="border-b border-neutral-200 py-2 text-right">
        <button
          className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-60"
          disabled={isPending}
          form={`quote-line-${item.id}`}
          type="submit"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </td>
    </tr>
  );
}

export function QuoteTermsForm({ quote }: { quote: QuoteSummary }) {
  const [state, formAction, isPending] = useActionState(updateQuoteTermsAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="quoteId" type="hidden" value={quote.id} />
      <div className="grid gap-3 md:grid-cols-3">
        <label>
          <span className="text-sm font-medium">Discount</span>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            defaultValue={(quote.discountCents / 100).toFixed(2)}
            min={0}
            name="discount"
            step="0.01"
            type="number"
          />
        </label>
        <label>
          <span className="text-sm font-medium">Tax</span>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            defaultValue={(quote.taxCents / 100).toFixed(2)}
            min={0}
            name="tax"
            step="0.01"
            type="number"
          />
        </label>
        <label>
          <span className="text-sm font-medium">Deposit</span>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            defaultValue={(quote.depositCents / 100).toFixed(2)}
            min={0}
            name="deposit"
            step="0.01"
            type="number"
          />
        </label>
      </div>
      <label>
        <span className="text-sm font-medium">Valid until</span>
        <input
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 md:w-56"
          defaultValue={quote.expiresOn ?? ""}
          name="expiresOn"
          type="date"
        />
      </label>
      <label>
        <span className="text-sm font-medium">Customer notes</span>
        <textarea
          className="mt-1 min-h-24 w-full rounded-md border border-neutral-300 px-3 py-2"
          defaultValue={quote.customerNotes ?? ""}
          name="customerNotes"
        />
      </label>
      {state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null}
      <button
        className="w-fit rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving..." : "Save terms"}
      </button>
    </form>
  );
}

const decisionLabels: Partial<Record<QuoteStatus, string>> = {
  ready: "Mark ready",
  sent: "Mark sent",
  viewed: "Mark viewed",
  accepted: "Record acceptance",
  rejected: "Record rejection",
  expired: "Record expiry",
  cancelled: "Cancel quote",
  draft: "Reopen for editing"
};

export function QuoteStatusForm({
  quote,
  today,
  canOverride
}: {
  quote: QuoteSummary;
  today: string;
  canOverride: boolean;
}) {
  const [state, formAction, isPending] = useActionState(transitionQuoteAction, initialState);
  const nextStatuses = availableTransitions(quote, today, canOverride);

  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        This quote is {quote.status} and has no remaining actions.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input name="quoteId" type="hidden" value={quote.id} />
      <input name="expectedStatus" type="hidden" value={quote.status} />
      <label>
        <span className="text-sm font-medium">Reason</span>
        <input
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          name="reason"
          placeholder="Required to record a rejection or cancel an accepted quote"
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

function availableTransitions(
  quote: QuoteSummary,
  today: string,
  canOverride: boolean
): QuoteStatus[] {
  const expired = isPastExpiry(quote.expiresOn, today);

  switch (quote.status) {
    case "draft":
      return ["ready", "cancelled"];
    case "ready":
      return ["sent", "draft", "cancelled"];
    case "sent":
      return [
        "viewed",
        "accepted",
        "rejected",
        ...(expired ? (["expired"] as const) : []),
        "cancelled"
      ];
    case "viewed":
      return ["accepted", "rejected", ...(expired ? (["expired"] as const) : []), "cancelled"];
    case "accepted":
      return canOverride ? ["cancelled"] : [];
    default:
      return [];
  }
}
