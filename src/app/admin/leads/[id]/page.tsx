import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserWithRoles } from "@/domains/auth/server";
import { getAdminLeadDetail, listAssignableStaff } from "@/domains/leads/admin";
import { hasAnyRole } from "@/domains/auth/roles";
import { LeadAssignmentForm, LeadNoteForm, LeadStatusForm } from "./lead-detail-forms";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminLeadDetailPage({ params }: PageProps) {
  const { roles } = await requireUserWithRoles([
    "owner",
    "admin",
    "estimator",
    "dispatcher",
    "viewer"
  ]);
  const { id } = await params;
  const lead = await getAdminLeadDetail(id);

  if (!lead) {
    notFound();
  }

  const canAssign = hasAnyRole(roles, ["owner", "admin", "estimator"]);
  const staff = canAssign ? await listAssignableStaff() : [];

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-medium text-teal-700" href="/admin/leads">
              Back to leads
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">{lead.reference}</h1>
            <p className="mt-1 text-neutral-700">{lead.customerName}</p>
            <p className="mt-1 text-sm text-neutral-600">
              Assigned to {lead.assignedToName ?? "nobody yet"}
            </p>
          </div>
          <span className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
            {lead.status}
          </span>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4">
            <div className="rounded-md border border-neutral-300 bg-white p-4">
              <h2 className="font-semibold">Move details</h2>
              <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div><dt className="text-neutral-600">Move type</dt><dd>{lead.moveType.replace("_", " ")}</dd></div>
                <div><dt className="text-neutral-600">Requested date</dt><dd>{lead.requestedMoveDate ?? "Flexible"}</dd></div>
                <div><dt className="text-neutral-600">Bedrooms</dt><dd>{lead.bedroomCount ?? "Unknown"}</dd></div>
                <div><dt className="text-neutral-600">Boxes</dt><dd>{lead.estimatedBoxes ?? "Unknown"}</dd></div>
                <div><dt className="text-neutral-600">Packing</dt><dd>{lead.needsPacking ? "Yes" : "No"}</dd></div>
                <div><dt className="text-neutral-600">Storage</dt><dd>{lead.needsStorage ? "Yes" : "No"}</dd></div>
              </dl>
              {lead.notes ? <p className="mt-4 text-sm text-neutral-700">{lead.notes}</p> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <AddressPanel title="Origin" address={lead.originAddress} />
              <AddressPanel title="Destination" address={lead.destinationAddress} />
            </div>

            <div className="rounded-md border border-neutral-300 bg-white p-4">
              <h2 className="font-semibold">Timeline</h2>
              <div className="mt-3 grid gap-3">
                {[...lead.activities, ...lead.auditEvents]
                  .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
                  .map((item) => (
                    <div className="border-t border-neutral-200 pt-3 text-sm" key={item.id}>
                      <div className="font-medium">
                        {"activityType" in item ? item.activityType.replace("_", " ") : item.eventType}
                      </div>
                      {"outcome" in item && item.outcome ? <div className="text-neutral-700">{item.outcome}</div> : null}
                      <div className="text-neutral-500">{new Date(item.occurredAt).toLocaleString("en-US")}</div>
                    </div>
                  ))}
                {lead.activities.length === 0 && lead.auditEvents.length === 0 ? (
                  <p className="text-sm text-neutral-600">No timeline events yet.</p>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <div className="rounded-md border border-neutral-300 bg-white p-4">
              <h2 className="font-semibold">Customer</h2>
              <p className="mt-2 text-sm">{lead.customerEmail ?? "No email"}</p>
              <p className="text-sm">{lead.customerPhone ?? "No phone"}</p>
            </div>
            <div className="rounded-md border border-neutral-300 bg-white p-4">
              <h2 className="font-semibold">Qualify lead</h2>
              <div className="mt-3">
                <LeadStatusForm currentStatus={lead.status} leadId={lead.id} />
              </div>
            </div>
            {canAssign ? (
              <div className="rounded-md border border-neutral-300 bg-white p-4">
                <h2 className="font-semibold">Ownership</h2>
                <div className="mt-3">
                  <LeadAssignmentForm
                    assignedProfileId={lead.assignedProfileId}
                    leadId={lead.id}
                    staff={staff}
                  />
                </div>
              </div>
            ) : null}
            <div className="rounded-md border border-neutral-300 bg-white p-4">
              <h2 className="font-semibold">Notes</h2>
              <div className="mt-3">
                <LeadNoteForm leadId={lead.id} />
              </div>
              <div className="mt-4 grid gap-3">
                {lead.staffNotes.map((note) => (
                  <div className="border-t border-neutral-200 pt-3 text-sm" key={note.id}>
                    <p>{note.body}</p>
                    <p className="mt-1 text-neutral-500">
                      {note.authorName ?? "Staff"} - {new Date(note.createdAt).toLocaleString("en-US")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function AddressPanel({
  title,
  address
}: {
  title: string;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    accessNotes: string | null;
  } | null;
}) {
  return (
    <div className="rounded-md border border-neutral-300 bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      {address ? (
        <address className="mt-3 text-sm not-italic text-neutral-700">
          <div>{address.line1}</div>
          {address.line2 ? <div>{address.line2}</div> : null}
          <div>{address.city}, {address.state} {address.postalCode}</div>
          {address.accessNotes ? <p className="mt-2">{address.accessNotes}</p> : null}
        </address>
      ) : (
        <p className="mt-3 text-sm text-neutral-600">No address captured.</p>
      )}
    </div>
  );
}
