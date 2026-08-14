import { z } from "zod";
import { createSupabaseServerClient } from "@/domains/auth/server";
import type { RoleCode } from "@/domains/auth/roles";
import { canTransitionJob, jobStatusSchema, type JobStatus } from "./status";

export type JobSummary = {
  id: string;
  reference: string;
  status: JobStatus;
  leadId: string;
  quoteId: string;
  quoteReference: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  scheduledDate: string | null;
  arrivalWindowStart: string | null;
  arrivalWindowEnd: string | null;
  crewSize: number;
  truckCount: number;
  estimatedDurationMinutes: number;
  estimatedRevenueCents: number;
  operationalNotes: string | null;
  customerNotes: string | null;
  decisionNotes: string | null;
  originAddress: JobAddress | null;
  destinationAddress: JobAddress | null;
  createdAt: string;
};

export type JobAddress = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  accessNotes: string | null;
};

type AddressRow = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  access_notes: string | null;
};

type JobRow = {
  id: string;
  reference: string;
  status: JobStatus;
  lead_id: string;
  quote_id: string;
  scheduled_date: string | null;
  arrival_window_start: string | null;
  arrival_window_end: string | null;
  crew_size: number;
  truck_count: number;
  estimated_duration_minutes: number;
  estimated_revenue_cents: number;
  operational_notes: string | null;
  customer_notes: string | null;
  decision_notes: string | null;
  created_at: string;
  quote: { reference: string } | null;
  customers: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  origin: AddressRow | null;
  destination: AddressRow | null;
};

const jobSelect =
  "id, reference, status, lead_id, quote_id, scheduled_date, arrival_window_start, arrival_window_end, crew_size, truck_count, estimated_duration_minutes, estimated_revenue_cents, operational_notes, customer_notes, decision_notes, created_at, quote:quotes!jobs_quote_id_fkey(reference), customers(first_name, last_name, email, phone), origin:addresses!jobs_origin_address_id_fkey(line1, line2, city, state, postal_code, access_notes), destination:addresses!jobs_destination_address_id_fkey(line1, line2, city, state, postal_code, access_notes)";

const okResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }).loose(),
  z.object({ ok: z.literal(false), code: z.string(), message: z.string() })
]);

export async function createJobFromQuote(params: {
  quoteId: string;
  scheduledDate?: string | null;
  arrivalWindowStart?: string | null;
  arrivalWindowEnd?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_job_from_quote", {
    p_quote_id: params.quoteId,
    p_scheduled_date: params.scheduledDate ?? null,
    p_arrival_window_start: params.arrivalWindowStart ?? null,
    p_arrival_window_end: params.arrivalWindowEnd ?? null
  });

  if (error) {
    throw new Error(`Unable to create the job: ${error.message}`);
  }

  const result = z
    .discriminatedUnion("ok", [
      z.object({
        ok: z.literal(true),
        created: z.boolean(),
        jobId: z.string().uuid(),
        reference: z.string()
      }),
      z.object({ ok: z.literal(false), code: z.string(), message: z.string() })
    ])
    .parse(data);

  return result.ok
    ? {
        ok: true as const,
        created: result.created,
        jobId: result.jobId,
        reference: result.reference
      }
    : { ok: false as const, message: result.message };
}

export async function getJob(jobId: string): Promise<JobSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(jobSelect)
    .eq("id", jobId)
    .maybeSingle()
    .returns<JobRow | null>();

  if (error) {
    throw new Error(`Unable to load the job: ${error.message}`);
  }

  return data ? mapJob(data) : null;
}

export async function getJobForQuote(quoteId: string): Promise<JobSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(jobSelect)
    .eq("quote_id", quoteId)
    .maybeSingle()
    .returns<JobRow | null>();

  if (error) {
    throw new Error(`Unable to load the job: ${error.message}`);
  }

  return data ? mapJob(data) : null;
}

export const jobListFiltersSchema = z.object({
  status: jobStatusSchema.or(z.literal("all")).or(z.literal("upcoming")).default("upcoming"),
  /** ISO calendar date the upcoming board counts from. */
  from: z.string().optional()
});

export type JobListFilters = z.infer<typeof jobListFiltersSchema>;

export async function listJobs(filters: Partial<JobListFilters> = {}): Promise<JobSummary[]> {
  const parsed = jobListFiltersSchema.parse(filters);
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("jobs").select(jobSelect).limit(100);

  if (parsed.status === "upcoming") {
    // The board is the work still ahead: dated, not finished, not cancelled.
    query = query
      .in("status", ["scheduled", "confirmed", "in_progress"])
      .gte("scheduled_date", parsed.from ?? new Date().toISOString().slice(0, 10))
      .order("scheduled_date", { ascending: true })
      .order("arrival_window_start", { ascending: true });
  } else {
    if (parsed.status !== "all") {
      query = query.eq("status", parsed.status);
    }

    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query.returns<JobRow[]>();

  if (error) {
    throw new Error(`Unable to load jobs: ${error.message}`);
  }

  return (data ?? []).map(mapJob);
}

export async function scheduleJob(params: {
  jobId: string;
  scheduledDate: string;
  arrivalWindowStart: string;
  arrivalWindowEnd: string;
}) {
  if (!params.scheduledDate || !params.arrivalWindowStart || !params.arrivalWindowEnd) {
    return {
      ok: false as const,
      message: "A scheduled job needs a date and both ends of its arrival window."
    };
  }

  if (params.arrivalWindowEnd <= params.arrivalWindowStart) {
    return { ok: false as const, message: "The arrival window must end after it starts." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("schedule_job", {
    p_job_id: params.jobId,
    p_scheduled_date: params.scheduledDate,
    p_arrival_window_start: params.arrivalWindowStart,
    p_arrival_window_end: params.arrivalWindowEnd
  });

  if (error) {
    throw new Error(`Unable to schedule the job: ${error.message}`);
  }

  const result = okResultSchema.parse(data);
  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}

export async function updateJobRequirements(params: {
  jobId: string;
  crewSize: number;
  truckCount: number;
  estimatedDurationMinutes: number;
  operationalNotes: string | null;
}) {
  const whole = [params.crewSize, params.truckCount, params.estimatedDurationMinutes];

  if (whole.some((value) => !Number.isInteger(value) || value <= 0)) {
    return {
      ok: false as const,
      message: "Crew, trucks, and duration must be whole numbers above zero."
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_job_requirements", {
    p_job_id: params.jobId,
    p_crew_size: params.crewSize,
    p_truck_count: params.truckCount,
    p_estimated_duration_minutes: params.estimatedDurationMinutes,
    p_operational_notes: params.operationalNotes
  });

  if (error) {
    throw new Error(`Unable to update the job: ${error.message}`);
  }

  const result = okResultSchema.parse(data);
  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}

export async function transitionJobStatus(params: {
  jobId: string;
  expectedStatus: JobStatus;
  nextStatus: JobStatus;
  reason?: string;
  hasSchedule: boolean;
  actorRoles: readonly RoleCode[];
}) {
  const decision = canTransitionJob({
    currentStatus: params.expectedStatus,
    nextStatus: params.nextStatus,
    actorRoles: params.actorRoles,
    reason: params.reason,
    hasSchedule: params.hasSchedule
  });

  if (!decision.allowed) {
    return { ok: false as const, message: decision.reason };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("transition_job_status", {
    p_job_id: params.jobId,
    p_expected_status: params.expectedStatus,
    p_next_status: params.nextStatus,
    p_reason: params.reason?.trim() || null
  });

  if (error) {
    throw new Error(`Unable to update the job: ${error.message}`);
  }

  const result = okResultSchema.parse(data);
  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}

function mapJob(job: JobRow): JobSummary {
  return {
    id: job.id,
    reference: job.reference,
    status: job.status,
    leadId: job.lead_id,
    quoteId: job.quote_id,
    quoteReference: job.quote?.reference ?? "Unknown quote",
    customerName: job.customers
      ? `${job.customers.first_name} ${job.customers.last_name}`
      : "Unknown customer",
    customerEmail: job.customers?.email ?? null,
    customerPhone: job.customers?.phone ?? null,
    scheduledDate: job.scheduled_date,
    arrivalWindowStart: trimSeconds(job.arrival_window_start),
    arrivalWindowEnd: trimSeconds(job.arrival_window_end),
    crewSize: job.crew_size,
    truckCount: job.truck_count,
    estimatedDurationMinutes: job.estimated_duration_minutes,
    estimatedRevenueCents: job.estimated_revenue_cents,
    operationalNotes: job.operational_notes,
    customerNotes: job.customer_notes,
    decisionNotes: job.decision_notes,
    originAddress: mapAddress(job.origin),
    destinationAddress: mapAddress(job.destination),
    createdAt: job.created_at
  };
}

function mapAddress(address: AddressRow | null): JobAddress | null {
  if (!address) {
    return null;
  }

  return {
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postalCode: address.postal_code,
    accessNotes: address.access_notes
  };
}

/** Postgres returns `08:00:00`; time inputs want `08:00`. */
function trimSeconds(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}
