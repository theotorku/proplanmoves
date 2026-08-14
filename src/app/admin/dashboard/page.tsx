import Link from "next/link";
import { Suspense } from "react";
import { hasAnyRole } from "@/domains/auth/roles";
import { requireUserWithRoles } from "@/domains/auth/server";
import { getDashboardMetrics } from "@/domains/dashboard/service";
import { formatCents, formatPercent } from "@/domains/dashboard/metrics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, roles } = await requireUserWithRoles([
    "owner",
    "admin",
    "estimator",
    "dispatcher",
    "viewer"
  ]);
  const includeJobs = hasAnyRole(roles, ["owner", "admin", "dispatcher", "viewer"]);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-300 pb-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Operations overview</h1>
          </div>
          <p className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700">
            {user.email ?? user.id}
          </p>
        </div>

        <Suspense fallback={<MetricsSkeleton />}>
          <Metrics includeJobs={includeJobs} />
        </Suspense>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex rounded-md bg-teal-700 px-4 py-2 font-medium text-white"
            href="/admin/leads"
          >
            View leads
          </Link>
          {includeJobs ? (
            <Link
              className="inline-flex rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium"
              href="/admin/jobs"
            >
              View schedule
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}

async function Metrics({ includeJobs }: { includeJobs: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const metrics = await getDashboardMetrics({ today, includeJobs });

  return (
    <>
      <section aria-label="Key metrics" className="grid gap-4 py-6 md:grid-cols-4">
        <Tile
          hint={`Created in the last ${metrics.windowDays} days`}
          label="New leads"
          value={String(metrics.newLeads)}
        />
        <Tile hint="Not yet won or closed" label="Open pipeline" value={String(metrics.openLeads)} />
        <Tile
          hint={`${metrics.quotesAccepted} of ${metrics.quotesSent} sent quotes accepted`}
          label="Quote acceptance"
          value={formatPercent(metrics.conversion.quoteAcceptancePercent)}
        />
        {includeJobs ? (
          <Tile
            hint="Every job not cancelled"
            label="Booked revenue"
            value={formatCents(metrics.bookedRevenueCents)}
          />
        ) : (
          <Tile
            hint={`Leads created in the last ${metrics.windowDays} days that were won`}
            label="Lead conversion"
            value={formatPercent(metrics.conversion.leadToWonPercent)}
          />
        )}
      </section>

      {includeJobs ? (
        <section aria-label="Upcoming jobs" className="rounded-md border border-neutral-300 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-semibold">Upcoming jobs</h2>
            <Link className="text-sm text-teal-700" href="/admin/jobs">
              Full schedule ({metrics.upcomingJobCount})
            </Link>
          </div>
          {metrics.upcomingJobs.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-600">
              Nothing is on the calendar from today onward.
            </p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {metrics.upcomingJobs.map((job) => (
                <li className="border-t border-neutral-200 pt-3 text-sm" key={job.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link className="font-mono text-teal-700" href={`/admin/jobs/${job.id}`}>
                      {job.reference}
                    </Link>
                    <span className="text-neutral-600">
                      {job.scheduledDate} · {job.arrivalWindowStart} – {job.arrivalWindowEnd}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-neutral-700">
                    <span>{job.customerName}</span>
                    <span>
                      {job.crewSize} movers, {job.truckCount}{" "}
                      {job.truckCount === 1 ? "truck" : "trucks"}
                    </span>
                    <span>{job.status.replace("_", " ")}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-neutral-300 bg-white p-4">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading key metrics" className="grid gap-4 py-6 md:grid-cols-4">
      {["one", "two", "three", "four"].map((key) => (
        <div className="rounded-md border border-neutral-300 bg-white p-4" key={key}>
          <div className="h-4 w-24 rounded bg-neutral-200" />
          <div className="mt-3 h-6 w-16 rounded bg-neutral-200" />
          <div className="mt-2 h-3 w-32 rounded bg-neutral-100" />
        </div>
      ))}
    </section>
  );
}
