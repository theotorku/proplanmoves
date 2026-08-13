"use client";

import { useActionState } from "react";
import type { EstimateSummary, EstimateSummaryLineItem } from "@/domains/estimation/service";
import { isEstimateEditable, type EstimateStatus } from "@/domains/estimation/status";
import {
  generateEstimateAction,
  reviewEstimateAction,
  updateEstimateLineItemAction,
  type LeadActionState
} from "../actions";

const initialState: LeadActionState = {};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

function formatCents(cents: number) {
  return money.format(cents / 100);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function EstimatePanel({
  leadId,
  leadStatus,
  estimate,
  canPrepare,
  canApprove
}: {
  leadId: string;
  leadStatus: string;
  estimate: EstimateSummary | null;
  canPrepare: boolean;
  canApprove: boolean;
}) {
  const estimatable = leadStatus === "qualified" || leadStatus === "estimate_pending";

  return (
    <div className="rounded-md border border-neutral-300 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-semibold">Estimate</h2>
        {estimate ? (
          <span className="rounded-md border border-neutral-300 px-2 py-1 text-xs uppercase tracking-wide text-neutral-700">
            {estimate.status.replace("_", " ")}
          </span>
        ) : null}
      </div>

      {estimate ? (
        <EstimateDetail
          canApprove={canApprove}
          canPrepare={canPrepare}
          estimate={estimate}
          leadId={leadId}
        />
      ) : (
        <p className="mt-3 text-sm text-neutral-600">
          No estimate has been generated for this lead yet.
        </p>
      )}

      {canPrepare && estimatable ? (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <GenerateEstimateForm hasEstimate={Boolean(estimate)} leadId={leadId} />
        </div>
      ) : null}

      {canPrepare && !estimatable ? (
        <p className="mt-4 border-t border-neutral-200 pt-4 text-sm text-neutral-600">
          Qualify the lead before generating an estimate.
        </p>
      ) : null}
    </div>
  );
}

function EstimateDetail({
  leadId,
  estimate,
  canPrepare,
  canApprove
}: {
  leadId: string;
  estimate: EstimateSummary;
  canPrepare: boolean;
  canApprove: boolean;
}) {
  const status = estimate.status as EstimateStatus;
  const editable = isEstimateEditable(status);

  return (
    <div className="mt-3 grid gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-sm">{estimate.reference}</span>
        <span className="text-2xl font-semibold">
          {formatCents(estimate.lowTotalCents)} – {formatCents(estimate.highTotalCents)}
        </span>
        <span className="text-sm text-neutral-600">{estimate.confidence} confidence</span>
      </div>

      <dl className="grid gap-3 text-sm md:grid-cols-4">
        <div>
          <dt className="text-neutral-600">Crew</dt>
          <dd>{estimate.crewSize} movers</dd>
        </div>
        <div>
          <dt className="text-neutral-600">Trucks</dt>
          <dd>{estimate.truckCount}</dd>
        </div>
        <div>
          <dt className="text-neutral-600">On site</dt>
          <dd>{formatDuration(estimate.estimatedMinutes)}</dd>
        </div>
        <div>
          <dt className="text-neutral-600">Travel</dt>
          <dd>{formatDuration(estimate.travelAllowanceMinutes)}</dd>
        </div>
      </dl>

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
          {estimate.lineItems.map((item) => (
            <LineItemRow
              editable={editable && canPrepare}
              item={item}
              key={item.id}
              leadId={leadId}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="border-t border-neutral-200 py-2 font-medium" colSpan={3}>
              Subtotal
            </td>
            <td className="border-t border-neutral-200 py-2 text-right font-medium">
              {formatCents(estimate.lowTotalCents)}
            </td>
          </tr>
        </tfoot>
      </table>

      {estimate.assumptions.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">Assumptions</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700">
            {estimate.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {estimate.warnings.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-amber-700">Warnings</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-700">
            {estimate.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {canPrepare ? (
        <ReviewForm
          canApprove={canApprove}
          currentStatus={status}
          estimateId={estimate.id}
          leadId={leadId}
        />
      ) : null}
    </div>
  );
}

function LineItemRow({
  leadId,
  item,
  editable
}: {
  leadId: string;
  item: EstimateSummaryLineItem;
  editable: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updateEstimateLineItemAction,
    initialState
  );

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
        <label className="block" htmlFor={`quantity-${item.id}`}>
          {item.description}
        </label>
        {state.message ? <span className="text-xs text-amber-700">{state.message}</span> : null}
      </td>
      <td className="border-b border-neutral-200 py-2">
        <form action={formAction} className="flex items-center gap-2" id={`line-item-${item.id}`}>
          <input name="leadId" type="hidden" value={leadId} />
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
          form={`line-item-${item.id}`}
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
          form={`line-item-${item.id}`}
          type="submit"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </td>
    </tr>
  );
}

function ReviewForm({
  leadId,
  estimateId,
  currentStatus,
  canApprove
}: {
  leadId: string;
  estimateId: string;
  currentStatus: EstimateStatus;
  canApprove: boolean;
}) {
  const [state, formAction, isPending] = useActionState(reviewEstimateAction, initialState);
  const canSubmitForReview = currentStatus === "generated" || currentStatus === "rejected";
  const isUnderReview = currentStatus === "under_review";

  if (!canSubmitForReview && !isUnderReview) {
    return state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null;
  }

  return (
    <form action={formAction} className="grid gap-3 border-t border-neutral-200 pt-4">
      <input name="leadId" type="hidden" value={leadId} />
      <input name="estimateId" type="hidden" value={estimateId} />
      <input name="expectedStatus" type="hidden" value={currentStatus} />

      {isUnderReview && canApprove ? (
        <label>
          <span className="text-sm font-medium">Rejection reason</span>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            name="reason"
            placeholder="Required when rejecting"
          />
        </label>
      ) : null}

      {state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null}

      <div className="flex flex-wrap gap-2">
        {canSubmitForReview ? (
          <button
            className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={isPending}
            name="nextStatus"
            type="submit"
            value="under_review"
          >
            Submit for review
          </button>
        ) : null}
        {isUnderReview && canApprove ? (
          <>
            <button
              className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
              disabled={isPending}
              name="nextStatus"
              type="submit"
              value="approved"
            >
              Approve
            </button>
            <button
              className="rounded-md border border-neutral-300 px-4 py-2 font-medium disabled:opacity-60"
              disabled={isPending}
              name="nextStatus"
              type="submit"
              value="rejected"
            >
              Reject
            </button>
          </>
        ) : null}
        {isUnderReview && !canApprove ? (
          <p className="text-sm text-neutral-600">
            Waiting on an owner or admin to approve this estimate.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function GenerateEstimateForm({ leadId, hasEstimate }: { leadId: string; hasEstimate: boolean }) {
  const [state, formAction, isPending] = useActionState(generateEstimateAction, initialState);

  return (
    <form action={formAction} className="grid gap-2">
      <input name="leadId" type="hidden" value={leadId} />
      {state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null}
      <button
        className="w-fit rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending
          ? "Calculating..."
          : hasEstimate
            ? "Recalculate as a new estimate"
            : "Generate estimate"}
      </button>
      {hasEstimate ? (
        <p className="text-xs text-neutral-600">
          Recalculating keeps the current estimate and records a new one.
        </p>
      ) : null}
    </form>
  );
}
