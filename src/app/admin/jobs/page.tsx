import Link from "next/link";
import { requireAnyRole } from "@/domains/auth/server";
import { jobListFiltersSchema, listJobs, type JobSummary } from "@/domains/jobs/service";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminJobsPage({ searchParams }: PageProps) {
  await requireAnyRole(["owner", "admin", "dispatcher", "viewer"]);
  const query = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const requested = jobListFiltersSchema.safeParse({
    status: typeof query.status === "string" ? query.status : "upcoming",
    from: today
  });
  const filters = requested.success ? requested.data : jobListFiltersSchema.parse({ from: today });
  const jobs = await listJobs(filters);
  const upcoming = filters.status === "upcoming";

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">Jobs</p>
            <h1 className="mt-2 text-3xl font-semibold">
              {upcoming ? "Upcoming schedule" : "All jobs"}
            </h1>
          </div>
          <Link
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium"
            href="/admin/dashboard"
          >
            Dashboard
          </Link>
        </div>

        <form className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-neutral-300 bg-white p-4">
          <label>
            <span className="text-sm font-medium">Show</span>
            <select
              className="mt-1 w-56 rounded-md border border-neutral-300 px-3 py-2"
              defaultValue={filters.status}
              name="status"
            >
              <option value="upcoming">Upcoming schedule</option>
              <option value="all">All jobs</option>
              <option value="unscheduled">Needs scheduling</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <button className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white" type="submit">
            Apply
          </button>
        </form>

        {upcoming ? <UpcomingBoard jobs={jobs} /> : <JobTable jobs={jobs} />}
      </div>
    </main>
  );
}

function UpcomingBoard({ jobs }: { jobs: JobSummary[] }) {
  if (jobs.length === 0) {
    return (
      <p className="rounded-md border border-neutral-300 bg-white px-4 py-6 text-neutral-600">
        Nothing is on the calendar from today onward.
      </p>
    );
  }

  const byDate = new Map<string, JobSummary[]>();

  for (const job of jobs) {
    const date = job.scheduledDate ?? "Unscheduled";
    byDate.set(date, [...(byDate.get(date) ?? []), job]);
  }

  return (
    <div className="grid gap-4">
      {[...byDate.entries()].map(([date, dayJobs]) => (
        <section className="rounded-md border border-neutral-300 bg-white p-4" key={date}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-semibold">
              {new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric"
              })}
            </h2>
            <p className="text-sm text-neutral-600">
              {dayJobs.length} {dayJobs.length === 1 ? "job" : "jobs"} ·{" "}
              {dayJobs.reduce((total, job) => total + job.crewSize, 0)} movers ·{" "}
              {dayJobs.reduce((total, job) => total + job.truckCount, 0)} trucks
            </p>
          </div>
          <ul className="mt-3 grid gap-3">
            {dayJobs.map((job) => (
              <li className="border-t border-neutral-200 pt-3 text-sm" key={job.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link className="font-mono text-teal-700" href={`/admin/jobs/${job.id}`}>
                    {job.reference}
                  </Link>
                  <span className="text-neutral-600">{job.status.replace("_", " ")}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 text-neutral-700">
                  <span>
                    {job.arrivalWindowStart} – {job.arrivalWindowEnd}
                  </span>
                  <span>{job.customerName}</span>
                  <span>
                    {job.crewSize} movers, {job.truckCount}{" "}
                    {job.truckCount === 1 ? "truck" : "trucks"}
                  </span>
                  <span>{job.originAddress?.city ?? "Origin TBD"}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function JobTable({ jobs }: { jobs: JobSummary[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-300 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-neutral-100 text-neutral-700">
          <tr>
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Crew</th>
            <th className="px-4 py-3">Value</th>
          </tr>
        </thead>
        <tbody>
          {jobs.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-neutral-600" colSpan={6}>
                No jobs match this filter.
              </td>
            </tr>
          ) : (
            jobs.map((job) => (
              <tr className="border-t border-neutral-200" key={job.id}>
                <td className="px-4 py-3 font-mono">
                  <Link className="text-teal-700" href={`/admin/jobs/${job.id}`}>
                    {job.reference}
                  </Link>
                </td>
                <td className="px-4 py-3">{job.customerName}</td>
                <td className="px-4 py-3">{job.status.replace("_", " ")}</td>
                <td className="px-4 py-3">{job.scheduledDate ?? "Not scheduled"}</td>
                <td className="px-4 py-3">
                  {job.crewSize} / {job.truckCount}
                </td>
                <td className="px-4 py-3">{money.format(job.estimatedRevenueCents / 100)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
