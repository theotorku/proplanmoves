import Link from "next/link";
import { notFound } from "next/navigation";
import { hasAnyRole } from "@/domains/auth/roles";
import { requireUserWithRoles } from "@/domains/auth/server";
import { getJob, type JobAddress } from "@/domains/jobs/service";
import { isJobOpen } from "@/domains/jobs/status";
import { JobRequirementsForm, JobScheduleForm, JobStatusForm } from "./job-forms";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailPage({ params }: PageProps) {
  const { roles } = await requireUserWithRoles(["owner", "admin", "dispatcher", "viewer"]);
  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    notFound();
  }

  const canDispatch = hasAnyRole(roles, ["owner", "admin", "dispatcher"]);
  const editable = canDispatch && isJobOpen(job.status);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-medium text-teal-700" href="/admin/jobs">
              Back to schedule
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">{job.reference}</h1>
            <p className="mt-1 text-neutral-700">{job.customerName}</p>
            <p className="mt-1 text-sm text-neutral-600">
              From{" "}
              <Link className="text-teal-700" href={`/admin/quotes/${job.quoteId}`}>
                {job.quoteReference}
              </Link>
            </p>
          </div>
          <span className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
            {job.status.replace("_", " ")}
          </span>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-4">
            <div className="rounded-md border border-neutral-300 bg-white p-4">
              <h2 className="font-semibold">Booking</h2>
              <dl className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                <div>
                  <dt className="text-neutral-600">Date</dt>
                  <dd>{job.scheduledDate ?? "Not scheduled"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-600">Arrival</dt>
                  <dd>
                    {job.arrivalWindowStart && job.arrivalWindowEnd
                      ? `${job.arrivalWindowStart} – ${job.arrivalWindowEnd}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-600">Crew and trucks</dt>
                  <dd>
                    {job.crewSize} movers, {job.truckCount}{" "}
                    {job.truckCount === 1 ? "truck" : "trucks"}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-600">Booked value</dt>
                  <dd>{money.format(job.estimatedRevenueCents / 100)}</dd>
                </div>
              </dl>
              {job.customerNotes ? (
                <p className="mt-4 text-sm text-neutral-700">{job.customerNotes}</p>
              ) : null}
              {job.decisionNotes ? (
                <p className="mt-2 text-sm text-neutral-700">{job.decisionNotes}</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <AddressPanel address={job.originAddress} title="Origin" />
              <AddressPanel address={job.destinationAddress} title="Destination" />
            </div>

            {editable ? (
              <div className="rounded-md border border-neutral-300 bg-white p-4">
                <h2 className="font-semibold">Crew and trucks</h2>
                <div className="mt-3">
                  <JobRequirementsForm job={job} />
                </div>
              </div>
            ) : null}
          </div>

          <aside className="grid content-start gap-4">
            <div className="rounded-md border border-neutral-300 bg-white p-4">
              <h2 className="font-semibold">Customer</h2>
              <p className="mt-2 text-sm">{job.customerEmail ?? "No email"}</p>
              <p className="text-sm">{job.customerPhone ?? "No phone"}</p>
              <Link
                className="mt-2 inline-flex text-sm text-teal-700"
                href={`/admin/leads/${job.leadId}`}
              >
                Open the lead
              </Link>
            </div>

            {editable ? (
              <div className="rounded-md border border-neutral-300 bg-white p-4">
                <h2 className="font-semibold">Schedule</h2>
                <div className="mt-3">
                  <JobScheduleForm job={job} />
                </div>
              </div>
            ) : null}

            {canDispatch ? (
              <div className="rounded-md border border-neutral-300 bg-white p-4">
                <h2 className="font-semibold">Update status</h2>
                <div className="mt-3">
                  <JobStatusForm canOverride={hasAnyRole(roles, ["owner", "admin"])} job={job} />
                </div>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function AddressPanel({ title, address }: { title: string; address: JobAddress | null }) {
  return (
    <div className="rounded-md border border-neutral-300 bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      {address ? (
        <address className="mt-3 text-sm not-italic text-neutral-700">
          <div>{address.line1}</div>
          {address.line2 ? <div>{address.line2}</div> : null}
          <div>
            {address.city}, {address.state} {address.postalCode}
          </div>
          {address.accessNotes ? <p className="mt-2">{address.accessNotes}</p> : null}
        </address>
      ) : (
        <p className="mt-3 text-sm text-neutral-600">No address captured.</p>
      )}
    </div>
  );
}
