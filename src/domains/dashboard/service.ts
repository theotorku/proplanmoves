import { createSupabaseServerClient } from "@/domains/auth/server";
import { listJobs, type JobSummary } from "@/domains/jobs/service";
import { calculateConversionRates, reportingWindowStart, type ConversionRates } from "./metrics";

export type DashboardMetrics = {
  windowDays: number;
  newLeads: number;
  openLeads: number;
  quotesSent: number;
  quotesAccepted: number;
  conversion: ConversionRates;
  bookedRevenueCents: number;
  upcomingJobCount: number;
  upcomingJobs: JobSummary[];
};

type CountResult = { count: number | null; error: { message: string } | null };

function readCount(result: CountResult, label: string): number {
  if (result.error) {
    throw new Error(`Unable to load ${label}: ${result.error.message}`);
  }

  return result.count ?? 0;
}

/**
 * Every figure is read through the caller's own client, so role visibility
 * decides what the numbers cover. Callers that cannot read jobs are given the
 * lead and quote figures only, rather than a revenue of zero that reads as a
 * bad month instead of a permission boundary.
 */
export async function getDashboardMetrics(params: {
  today: string;
  includeJobs: boolean;
  windowDays?: number;
}): Promise<DashboardMetrics> {
  const windowDays = params.windowDays ?? 30;
  const windowStart = reportingWindowStart(params.today, windowDays);
  const supabase = await createSupabaseServerClient();

  const [newLeads, openLeads, wonLeads, quotesSent, quotesAccepted] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", windowStart),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "contacting", "qualified", "estimate_pending", "quote_pending"]),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "won")
      .gte("created_at", windowStart),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .not("sent_at", "is", null)
      .gte("sent_at", windowStart),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .not("accepted_at", "is", null)
      .gte("accepted_at", windowStart)
  ]);

  const metrics: DashboardMetrics = {
    windowDays,
    newLeads: readCount(newLeads, "new leads"),
    openLeads: readCount(openLeads, "open leads"),
    quotesSent: readCount(quotesSent, "sent quotes"),
    quotesAccepted: readCount(quotesAccepted, "accepted quotes"),
    conversion: calculateConversionRates({
      leadsCreated: readCount(newLeads, "new leads"),
      leadsWon: readCount(wonLeads, "won leads"),
      quotesSent: readCount(quotesSent, "sent quotes"),
      quotesAccepted: readCount(quotesAccepted, "accepted quotes")
    }),
    bookedRevenueCents: 0,
    upcomingJobCount: 0,
    upcomingJobs: []
  };

  if (!params.includeJobs) {
    return metrics;
  }

  const [bookedRevenue, upcomingJobs] = await Promise.all([
    supabase
      .from("jobs")
      .select("estimated_revenue_cents")
      .in("status", ["unscheduled", "scheduled", "confirmed", "in_progress", "completed"])
      .returns<{ estimated_revenue_cents: number }[]>(),
    listJobs({ status: "upcoming", from: params.today })
  ]);

  if (bookedRevenue.error) {
    throw new Error(`Unable to load booked revenue: ${bookedRevenue.error.message}`);
  }

  return {
    ...metrics,
    bookedRevenueCents: (bookedRevenue.data ?? []).reduce(
      (total, job) => total + job.estimated_revenue_cents,
      0
    ),
    upcomingJobCount: upcomingJobs.length,
    upcomingJobs: upcomingJobs.slice(0, 5)
  };
}
