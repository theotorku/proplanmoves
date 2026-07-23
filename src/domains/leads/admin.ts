import { createSupabaseServerClient } from "@/domains/auth/server";

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

export async function listAdminLeads(): Promise<AdminLeadSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, reference, status, move_type, requested_move_date, created_at, customers(first_name, last_name, email, phone)"
    )
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<LeadRow[]>();

  if (error) {
    throw new Error(`Unable to load leads: ${error.message}`);
  }

  return (data ?? []).map((lead) => ({
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
  }));
}
