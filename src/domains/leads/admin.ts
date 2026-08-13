import { z } from "zod";
import { createSupabaseServerClient } from "@/domains/auth/server";
import type { RoleCode } from "@/domains/auth/roles";
import {
  canTransitionLeadStatus,
  leadStatusSchema,
  type LeadStatus
} from "./status";

export const leadListFiltersSchema = z.object({
  status: leadStatusSchema.or(z.literal("all")).default("all"),
  search: z.string().trim().max(80).optional()
});

export type LeadListFilters = z.infer<typeof leadListFiltersSchema>;

export type AdminLeadSummary = {
  id: string;
  reference: string;
  status: string;
  moveType: string;
  requestedMoveDate: string | null;
  createdAt: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
};

export type AdminLeadDetail = AdminLeadSummary & {
  leadSource: string;
  notes: string | null;
  lostReason: string | null;
  bedroomCount: number | null;
  estimatedBoxes: number | null;
  needsPacking: boolean;
  needsStorage: boolean;
  originAddress: AddressSummary | null;
  destinationAddress: AddressSummary | null;
  staffNotes: LeadNote[];
  activities: LeadActivity[];
  auditEvents: LeadAuditEvent[];
};

type AddressSummary = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  accessNotes: string | null;
};

type LeadNote = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
};

type LeadActivity = {
  id: string;
  activityType: string;
  outcome: string | null;
  occurredAt: string;
};

type LeadAuditEvent = {
  id: string;
  eventType: string;
  occurredAt: string;
};

type LeadRow = {
  id: string;
  reference: string;
  status: string;
  move_type: string;
  requested_move_date: string | null;
  created_at: string;
  customers: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

type LeadDetailRow = {
  id: string;
  reference: string;
  customer_id: string;
  status: string;
  move_type: string;
  origin_address_id: string | null;
  destination_address_id: string | null;
  requested_move_date: string | null;
  bedroom_count: number | null;
  needs_packing: boolean;
  needs_storage: boolean;
  estimated_boxes: number | null;
  notes: string | null;
  lead_source: string;
  lost_reason: string | null;
  created_at: string;
  customers: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

type AddressRow = {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  access_notes: string | null;
};

type NoteRow = {
  id: string;
  body: string;
  created_at: string;
  profiles: { full_name: string } | null;
};

type ActivityRow = {
  id: string;
  activity_type: string;
  outcome: string | null;
  occurred_at: string;
};

type AuditRow = {
  id: string;
  event_type: string;
  occurred_at: string;
};

export async function listAdminLeads(filters: Partial<LeadListFilters> = {}): Promise<AdminLeadSummary[]> {
  const parsedFilters = leadListFiltersSchema.parse(filters);
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("leads")
    .select(
      "id, reference, status, move_type, requested_move_date, created_at, customers(first_name, last_name, email, phone)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (parsedFilters.status !== "all") {
    query = query.eq("status", parsedFilters.status);
  }

  if (parsedFilters.search) {
    query = query.ilike("reference", `%${parsedFilters.search}%`);
  }

  const { data, error } = await query.returns<LeadRow[]>();

  if (error) {
    throw new Error(`Unable to load leads: ${error.message}`);
  }

  return (data ?? []).map(mapLeadSummary);
}

export async function getAdminLeadDetail(leadId: string): Promise<AdminLeadDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "id, reference, customer_id, status, move_type, origin_address_id, destination_address_id, requested_move_date, bedroom_count, needs_packing, needs_storage, estimated_boxes, notes, lead_source, lost_reason, created_at, customers(first_name, last_name, email, phone)"
    )
    .eq("id", leadId)
    .maybeSingle()
    .returns<LeadDetailRow | null>();

  if (leadError) {
    throw new Error(`Unable to load lead: ${leadError.message}`);
  }

  if (!lead) {
    return null;
  }

  const addressIds = [lead.origin_address_id, lead.destination_address_id].filter(
    (value): value is string => Boolean(value)
  );

  const [addressesResult, notesResult, activitiesResult, auditResult] = await Promise.all([
    addressIds.length > 0
      ? supabase.from("addresses").select("id, line1, line2, city, state, postal_code, access_notes").in("id", addressIds).returns<AddressRow[]>()
      : Promise.resolve({ data: [] as AddressRow[], error: null }),
    supabase
      .from("lead_notes")
      .select("id, body, created_at, profiles(full_name)")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .returns<NoteRow[]>(),
    supabase
      .from("lead_activities")
      .select("id, activity_type, outcome, occurred_at")
      .eq("lead_id", lead.id)
      .order("occurred_at", { ascending: false })
      .returns<ActivityRow[]>(),
    supabase
      .from("audit_events")
      .select("id, event_type, occurred_at")
      .eq("entity_type", "lead")
      .eq("entity_id", lead.id)
      .order("occurred_at", { ascending: false })
      .returns<AuditRow[]>()
  ]);

  for (const result of [addressesResult, notesResult, activitiesResult, auditResult]) {
    if (result.error) {
      throw new Error(`Unable to load lead detail: ${result.error.message}`);
    }
  }

  const addresses = new Map((addressesResult.data ?? []).map((address) => [address.id, address]));

  return {
    ...mapLeadSummary(lead),
    leadSource: lead.lead_source,
    notes: lead.notes,
    lostReason: lead.lost_reason,
    bedroomCount: lead.bedroom_count,
    estimatedBoxes: lead.estimated_boxes,
    needsPacking: lead.needs_packing,
    needsStorage: lead.needs_storage,
    originAddress: mapAddress(lead.origin_address_id ? addresses.get(lead.origin_address_id) : undefined),
    destinationAddress: mapAddress(
      lead.destination_address_id ? addresses.get(lead.destination_address_id) : undefined
    ),
    staffNotes: (notesResult.data ?? []).map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.created_at,
      authorName: note.profiles?.full_name ?? null
    })),
    activities: (activitiesResult.data ?? []).map((activity) => ({
      id: activity.id,
      activityType: activity.activity_type,
      outcome: activity.outcome,
      occurredAt: activity.occurred_at
    })),
    auditEvents: (auditResult.data ?? []).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      occurredAt: event.occurred_at
    }))
  };
}

export async function updateLeadStatus(params: {
  leadId: string;
  nextStatus: LeadStatus;
  reason?: string;
  actorRoles: readonly RoleCode[];
}) {
  const supabase = await createSupabaseServerClient();
  const { data: lead, error: loadError } = await supabase
    .from("leads")
    .select("id, status")
    .eq("id", params.leadId)
    .single()
    .returns<{ id: string; status: LeadStatus }>();

  if (loadError) {
    throw new Error(`Unable to load lead: ${loadError.message}`);
  }

  const decision = canTransitionLeadStatus(
    lead.status,
    params.nextStatus,
    params.actorRoles,
    params.reason
  );

  if (!decision.allowed) {
    return { ok: false as const, message: decision.reason };
  }

  const lostReason =
    params.nextStatus === "lost" || params.nextStatus === "disqualified"
      ? params.reason?.trim()
      : null;

  const { data: updateResult, error: updateError } = await supabase
    .rpc("transition_lead_status", {
      p_lead_id: params.leadId,
      p_expected_status: lead.status,
      p_next_status: params.nextStatus,
      p_reason: lostReason
    });

  if (updateError) {
    throw new Error(`Unable to update lead: ${updateError.message}`);
  }

  const rpcResult = z
    .discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), changed: z.boolean() }),
      z.object({
        ok: z.literal(false),
        code: z.string(),
        message: z.string()
      })
    ])
    .parse(updateResult);

  return rpcResult.ok
    ? { ok: true as const }
    : { ok: false as const, message: rpcResult.message };
}

export async function addLeadNote(params: {
  leadId: string;
  body: string;
}) {
  const body = params.body.trim();

  if (!body) {
    return { ok: false as const, message: "Note body is required." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("add_lead_note_with_activity", {
    p_lead_id: params.leadId,
    p_body: body
  });

  if (error) {
    throw new Error(`Unable to add note: ${error.message}`);
  }

  const result = z
    .discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), noteId: z.string().uuid() }),
      z.object({ ok: z.literal(false), message: z.string() })
    ])
    .parse(data);

  return result.ok
    ? { ok: true as const }
    : { ok: false as const, message: result.message };
}

function mapLeadSummary(lead: LeadRow | LeadDetailRow): AdminLeadSummary {
  return {
    id: lead.id,
    reference: lead.reference,
    status: lead.status,
    moveType: lead.move_type,
    requestedMoveDate: lead.requested_move_date,
    createdAt: lead.created_at,
    customerName: lead.customers
      ? `${lead.customers.first_name} ${lead.customers.last_name}`
      : "Unknown customer",
    customerEmail: lead.customers?.email ?? null,
    customerPhone: lead.customers?.phone ?? null
  };
}

function mapAddress(address: AddressRow | undefined): AddressSummary | null {
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
