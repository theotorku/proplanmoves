import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyRole } from "@/domains/auth/server";
import { getQuote } from "@/domains/quotes/service";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PrintableQuotePage({ params }: PageProps) {
  await requireAnyRole(["owner", "admin", "estimator", "dispatcher", "viewer"]);
  const { id } = await params;
  const quote = await getQuote(id);

  if (!quote) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-10 text-neutral-900">
      <div className="print:hidden">
        <Link className="text-sm font-medium text-teal-700" href={`/admin/quotes/${quote.id}`}>
          Back to quote
        </Link>
      </div>

      <header className="mt-6 flex items-start justify-between gap-6 border-b border-neutral-300 pb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
            ProPlan Moves
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Moving quote</h1>
        </div>
        <dl className="text-right text-sm">
          <div>
            <dt className="text-neutral-600">Quote</dt>
            <dd className="font-mono">{quote.reference}</dd>
          </div>
          <div className="mt-2">
            <dt className="text-neutral-600">Valid until</dt>
            <dd>{quote.expiresOn ?? "On request"}</dd>
          </div>
        </dl>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
          Prepared for
        </h2>
        <p className="mt-1 font-medium">{quote.customerName}</p>
        {quote.customerEmail ? <p className="text-sm">{quote.customerEmail}</p> : null}
        {quote.customerPhone ? <p className="text-sm">{quote.customerPhone}</p> : null}
      </section>

      <table className="mt-8 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-300">
            <th className="py-2">Service</th>
            <th className="py-2">Quantity</th>
            <th className="py-2 text-right">Rate</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {quote.lineItems.map((item) => (
            <tr className="border-b border-neutral-200" key={item.id}>
              <td className="py-2">{item.description}</td>
              <td className="py-2">
                {item.quantity} {item.unit}
              </td>
              <td className="py-2 text-right">{money.format(item.unitAmountCents / 100)}</td>
              <td className="py-2 text-right">{money.format(item.totalAmountCents / 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-6 ml-auto grid max-w-xs gap-1 text-sm">
        <Row label="Subtotal" value={money.format(quote.subtotalCents / 100)} />
        {quote.discountCents > 0 ? (
          <Row label="Discount" value={`-${money.format(quote.discountCents / 100)}`} />
        ) : null}
        {quote.taxCents > 0 ? <Row label="Tax" value={money.format(quote.taxCents / 100)} /> : null}
        <Row emphasis label="Total" value={money.format(quote.totalCents / 100)} />
        {quote.depositCents > 0 ? (
          <Row label="Deposit due" value={money.format(quote.depositCents / 100)} />
        ) : null}
      </dl>

      {quote.customerNotes ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">Notes</h2>
          <p className="mt-1 whitespace-pre-line text-sm">{quote.customerNotes}</p>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-neutral-300 pt-4 text-xs text-neutral-600">
        <p>
          This quote is an estimate of charges based on the information provided and is valid until
          the date shown. Final charges reflect the services actually performed.
        </p>
        <p className="mt-1">Terms {quote.termsVersion}</p>
      </footer>
    </main>
  );
}

function Row({
  label,
  value,
  emphasis
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex justify-between border-t border-neutral-200 pt-1 ${
        emphasis ? "text-base font-semibold" : ""
      }`}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
