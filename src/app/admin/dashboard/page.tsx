import { requireAnyRole } from "@/domains/auth/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAnyRole([
    "owner",
    "admin",
    "estimator",
    "dispatcher",
    "viewer"
  ]);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-6">
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

        <section className="grid gap-4 py-6 md:grid-cols-4">
          {[
            ["New leads", "Live data pending"],
            ["Quotes sent", "Live data pending"],
            ["Accepted revenue", "Live data pending"],
            ["Scheduled jobs", "Live data pending"]
          ].map(([label, value]) => (
            <div
              className="rounded-md border border-neutral-300 bg-white p-4"
              key={label}
            >
              <p className="text-sm text-neutral-600">{label}</p>
              <p className="mt-2 font-mono text-xl font-semibold">{value}</p>
            </div>
          ))}
        </section>
        <Link
          className="inline-flex rounded-md bg-teal-700 px-4 py-2 font-medium text-white"
          href="/admin/leads"
        >
          View leads
        </Link>
      </div>
    </main>
  );
}
