import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
            ProPlan Moves OS
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight text-neutral-950">
            Local move operations, from first request to scheduled job.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-700">
            The foundation is ready for the required workflow: intake, lead
            qualification, deterministic estimates, quotes, acceptance, jobs,
            and live dashboard KPIs.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
            href="/quote-request"
          >
            Request a quote
          </Link>
          <Link
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium text-neutral-900 hover:bg-neutral-50"
            href="/admin/dashboard"
          >
            Open dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
