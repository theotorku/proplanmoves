import Link from "next/link";
import { requireAnyRole } from "@/domains/auth/server";
import { listAdminLeads } from "@/domains/leads/admin";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  await requireAnyRole(["owner", "admin", "estimator", "dispatcher", "viewer"]);
  const leads = await listAdminLeads();

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

        <div className="overflow-hidden rounded-md border border-neutral-300 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Move</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Move date</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-neutral-600" colSpan={6}>
                    No leads have been submitted yet.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr className="border-t border-neutral-200" key={lead.id}>
                    <td className="px-4 py-3 font-mono">{lead.reference}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{lead.customerName}</div>
                      <div className="text-neutral-600">{lead.customerEmail ?? lead.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3">{lead.moveType.replace("_", " ")}</td>
                    <td className="px-4 py-3">{lead.status}</td>
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
