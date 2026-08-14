import Link from "next/link";
import { notFound } from "next/navigation";
import { hasAnyRole } from "@/domains/auth/roles";
import { requireUserWithRoles } from "@/domains/auth/server";
import { getJobForQuote } from "@/domains/jobs/service";
import { getQuote } from "@/domains/quotes/service";
import { isPastExpiry, isQuoteEditable } from "@/domains/quotes/status";
import { JobPanel } from "./job-panel";
import { formatCents } from "@/lib/money";
import { QuoteLineItemsEditor, QuoteStatusForm, QuoteTermsForm } from "./quote-forms";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuoteDetailPage({ params }: PageProps) {
  const { roles } = await requireUserWithRoles([
    "owner",
    "admin",
    "estimator",
    "dispatcher",
    "viewer"
  ]);
  const { id } = await params;
  const quote = await getQuote(id);

  if (!quote) {
    notFound();
  }

  const canSeeJobs = hasAnyRole(roles, ["owner", "admin", "dispatcher", "viewer"]);
  const job = canSeeJobs ? await getJobForQuote(quote.id) : null;
  const today = new Date().toISOString().slice(0, 10);
  const canWork = hasAnyRole(roles, ["owner", "admin", "estimator"]);
  const editable = canWork && isQuoteEditable(quote.status);
  const overdue = isPastExpiry(quote.expiresOn, today);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-medium text-teal-700" href={`/admin/leads/${quote.leadId}`}>
              Back to {quote.leadReference}
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">{quote.reference}</h1>
            <p className="mt-1 text-neutral-700">{quote.customerName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
              {quote.status}
            </span>
            <Link
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium"
              href={`/admin/quotes/${quote.id}/print`}
            >
              Printable quote
            </Link>
          </div>
        </div>

        {overdue && quote.status !== "expired" ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This quote passed its valid-until date on {quote.expiresOn}. Record the expiry to take
            it out of play.
          </p>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-4">
            <div className="rounded-md border border-neutral-300 bg-white p-4">
              <h2 className="font-semibold">Line items</h2>
              <div className="mt-3">
                <QuoteLineItemsEditor editable={editable} quote={quote} />
              </div>
              <dl className="mt-4 grid gap-1 text-sm">
                <TotalRow label="Subtotal" value={formatCents(quote.subtotalCents)} />
                <TotalRow label="Discount" value={`-${formatCents(quote.discountCents)}`} />
                <TotalRow label="Tax" value={formatCents(quote.taxCents)} />
                <TotalRow emphasis label="Total" value={formatCents(quote.totalCents)} />
                <TotalRow label="Deposit due" value={formatCents(quote.depositCents)} />
              </dl>
            </div>

            {editable ? (
              <div className="rounded-md border border-neutral-300 bg-white p-4">
                <h2 className="font-semibold">Terms</h2>
                <div className="mt-3">
                  <QuoteTermsForm quote={quote} />
                </div>
              </div>
            ) : null}
          </div>

          <aside className="grid content-start gap-4">
            <div className="rounded-md border border-neutral-300 bg-white p-4">
              <h2 className="font-semibold">Customer</h2>
              <p className="mt-2 text-sm">{quote.customerEmail ?? "No email"}</p>
              <p className="text-sm">{quote.customerPhone ?? "No phone"}</p>
              <p className="mt-2 text-sm text-neutral-600">
                Valid until {quote.expiresOn ?? "no date set"}
              </p>
              <p className="text-sm text-neutral-600">Terms {quote.termsVersion}</p>
            </div>

            {canWork ? (
              <div className="rounded-md border border-neutral-300 bg-white p-4">
                <h2 className="font-semibold">Record a decision</h2>
                <div className="mt-3">
                  <QuoteStatusForm
                    canOverride={hasAnyRole(roles, ["owner", "admin"])}
                    hasLiveJob={Boolean(job) && job?.status !== "cancelled"}
                    quote={quote}
                    today={today}
                  />
                </div>
              </div>
            ) : null}

            {/* Estimators have no read access to jobs, so the panel would only
                ever tell them a job does not exist. */}
            {canSeeJobs ? (
              <JobPanel
                canDispatch={hasAnyRole(roles, ["owner", "admin", "dispatcher"])}
                job={job}
                quoteId={quote.id}
                quoteStatus={quote.status}
              />
            ) : null}

            <div className="rounded-md border border-neutral-300 bg-white p-4">
              <h2 className="font-semibold">History</h2>
              <dl className="mt-2 grid gap-1 text-sm text-neutral-700">
                <HistoryRow label="Created" value={quote.createdAt} />
                <HistoryRow label="Sent" value={quote.sentAt} />
                <HistoryRow label="Viewed" value={quote.viewedAt} />
                <HistoryRow label="Accepted" value={quote.acceptedAt} />
                <HistoryRow label="Rejected" value={quote.rejectedAt} />
              </dl>
              {quote.decisionNotes ? (
                <p className="mt-3 text-sm text-neutral-700">{quote.decisionNotes}</p>
              ) : null}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function TotalRow({
  label,
  value,
  emphasis
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex justify-between ${emphasis ? "font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function HistoryRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd>{value ? new Date(value).toLocaleString("en-US") : "—"}</dd>
    </div>
  );
}
