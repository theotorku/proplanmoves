import { QuoteRequestForm } from "./quote-request-form";

export default function QuoteRequestPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          Quote request
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Tell us about the move</h1>
        <p className="mt-3 text-neutral-700">
          Submit the basics and the operations team will qualify the lead before
          producing a reviewed estimate.
        </p>
      </div>
      <QuoteRequestForm />
    </main>
  );
}
