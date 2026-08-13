import Link from "next/link";
import { requireAnyRole } from "@/domains/auth/server";
import { leadListFiltersSchema, listAdminLeads, listAssignableStaff } from "@/domains/leads/admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  await requireAnyRole(["owner", "admin", "estimator", "dispatcher", "viewer"]);
  const query = await searchParams;
  // Filters arrive from user-editable query strings, so an unrecognized value
  // falls back to the unfiltered queue instead of failing the page.
  const requestedFilters = leadListFiltersSchema.safeParse({
    status: typeof query.status === "string" ? query.status : "all",
    assignee: typeof query.assignee === "string" ? query.assignee : "all",
    search: typeof query.search === "string" ? query.search : undefined
  });
  const filters = requestedFilters.success
    ? requestedFilters.data
    : leadListFiltersSchema.parse({});
  const [leads, staff] = await Promise.all([listAdminLeads(filters), listAssignableStaff()]);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
              Leads
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Lead intake queue</h1>
          </div>
          <Link className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium" href="/admin/dashboard">
            Dashboard
          </Link>
        </div>

        <form className="mb-4 grid gap-3 rounded-md border border-neutral-300 bg-white p-4 md:grid-cols-[180px_200px_1fr_auto]">
          <label>
            <span className="text-sm font-medium">Status</span>
            <select className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" defaultValue={filters.status} name="status">
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="contacting">Contacting</option>
              <option value="qualified">Qualified</option>
              <option value="estimate_pending">Estimate pending</option>
              <option value="quote_pending">Quote pending</option>
              <option value="won">Won</option>
              <option value="unresponsive">Unresponsive</option>
              <option value="disqualified">Disqualified</option>
              <option value="lost">Lost</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Assigned to</span>
            <select className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" defaultValue={filters.assignee} name="assignee">
              <option value="all">Anyone</option>
              <option value="unassigned">Unassigned</option>
              {staff.map((member) => (
                <option key={member.profileId} value={member.profileId}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Reference search</span>
            <input className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" defaultValue={filters.search ?? ""} name="search" />
          </label>
          <button className="self-end rounded-md bg-teal-700 px-4 py-2 font-medium text-white" type="submit">
            Filter
          </button>
        </form>

        <div className="overflow-hidden rounded-md border border-neutral-300 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Move</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned to</th>
                <th className="px-4 py-3">Move date</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-neutral-600" colSpan={7}>
                    No leads have been submitted yet.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr className="border-t border-neutral-200" key={lead.id}>
                    <td className="px-4 py-3 font-mono">
                      <Link className="text-teal-700" href={`/admin/leads/${lead.id}`}>
                        {lead.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{lead.customerName}</div>
                      <div className="text-neutral-600">{lead.customerEmail ?? lead.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3">{lead.moveType.replace("_", " ")}</td>
                    <td className="px-4 py-3">{lead.status}</td>
                    <td className="px-4 py-3">
                      {lead.assignedToName ?? <span className="text-neutral-500">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">{lead.requestedMoveDate ?? "Flexible"}</td>
                    <td className="px-4 py-3">{new Date(lead.createdAt).toLocaleDateString("en-US")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
