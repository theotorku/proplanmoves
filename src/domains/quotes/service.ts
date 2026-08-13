import { z } from "zod";
import { createSupabaseServerClient } from "@/domains/auth/server";
import type { RoleCode } from "@/domains/auth/roles";
import { canTransitionQuote, type QuoteStatus } from "./status";

export type QuoteLineItem = {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitAmountCents: number;
  totalAmountCents: number;
  category: string;
};

export type QuoteSummary = {
  id: string;
  reference: string;
  status: QuoteStatus;
  leadId: string;
  leadReference: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  expiresOn: string | null;
  termsVersion: string;
  customerNotes: string | null;
  decisionNotes: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  lineItems: QuoteLineItem[];
};

type QuoteRow = {
  id: string;
  reference: string;
  status: QuoteStatus;
  lead_id: string;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  deposit_cents: number;
  expires_on: string | null;
  terms_version: string;
  customer_notes: string | null;
  decision_notes: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
  leads: { reference: string } | null;
  customers: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

type QuoteLineItemRow = {
  id: string;
  code: string;
  description: string;
  quantity: number | string;
  unit: string;
  unit_amount_cents: number;
  total_amount_cents: number;
  category: string;
  sort_order: number;
};

const quoteSelect =
  "id, reference, status, lead_id, subtotal_cents, discount_cents, tax_cents, total_cents, deposit_cents, expires_on, terms_version, customer_notes, decision_notes, sent_at, viewed_at, accepted_at, rejected_at, created_at, leads(reference), customers(first_name, last_name, email, phone)";

const okResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }).loose(),
  z.object({ ok: z.literal(false), code: z.string(), message: z.string() })
]);

export async function createQuoteFromEstimate(params: {
  estimateId: string;
  expiresOn?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_quote_from_estimate", {
    p_estimate_id: params.estimateId,
    p_expires_on: params.expiresOn ?? null,
    p_terms_version: "terms-v1"
  });

  if (error) {
    throw new Error(`Unable to create the quote: ${error.message}`);
  }

  const result = z
    .discriminatedUnion("ok", [
      z.object({
        ok: z.literal(true),
        quoteId: z.string().uuid(),
        reference: z.string()
      }),
      z.object({ ok: z.literal(false), code: z.string(), message: z.string() })
    ])
    .parse(data);

  return result.ok
    ? { ok: true as const, quoteId: result.quoteId, reference: result.reference }
    : { ok: false as const, message: result.message };
}

export async function getQuote(quoteId: string): Promise<QuoteSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data: quote, error } = await supabase
    .from("quotes")
    .select(quoteSelect)
    .eq("id", quoteId)
    .maybeSingle()
    .returns<QuoteRow | null>();

  if (error) {
    throw new Error(`Unable to load the quote: ${error.message}`);
  }

  if (!quote) {
    return null;
  }

  const { data: lineItems, error: lineItemError } = await supabase
    .from("quote_line_items")
    .select(
      "id, code, description, quantity, unit, unit_amount_cents, total_amount_cents, category, sort_order"
    )
    .eq("quote_id", quote.id)
    .order("sort_order", { ascending: true })
    .returns<QuoteLineItemRow[]>();

  if (lineItemError) {
    throw new Error(`Unable to load the quote line items: ${lineItemError.message}`);
  }

  return mapQuote(quote, lineItems ?? []);
}

/** The quote a lead is currently working from, newest first. */
export async function getLatestQuoteForLead(leadId: string): Promise<QuoteSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .returns<{ id: string } | null>();

  if (error) {
    throw new Error(`Unable to load the quote: ${error.message}`);
  }

  return data ? getQuote(data.id) : null;
}

export async function updateQuoteLineItem(params: {
  lineItemId: string;
  quantity: number;
  unitAmountCents: number;
}) {
  if (!Number.isFinite(params.quantity) || params.quantity < 0) {
    return { ok: false as const, message: "Quantity must be zero or greater." };
  }

  if (!Number.isInteger(params.unitAmountCents) || params.unitAmountCents < 0) {
    return { ok: false as const, message: "Unit amount must be a whole number of cents." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_quote_line_item", {
    p_line_item_id: params.lineItemId,
    p_quantity: params.quantity,
    p_unit_amount_cents: params.unitAmountCents
  });

  if (error) {
    throw new Error(`Unable to update the line item: ${error.message}`);
  }

  const result = okResultSchema.parse(data);
  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}

export async function updateQuoteTerms(params: {
  quoteId: string;
  discountCents: number;
  taxCents: number;
  depositCents: number;
  expiresOn: string | null;
  customerNotes: string | null;
}) {
  const amounts = [params.discountCents, params.taxCents, params.depositCents];

  if (amounts.some((amount) => !Number.isInteger(amount) || amount < 0)) {
    return {
      ok: false as const,
      message: "Discount, tax, and deposit must be whole amounts of zero or more."
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_quote_terms", {
    p_quote_id: params.quoteId,
    p_discount_cents: params.discountCents,
    p_tax_cents: params.taxCents,
    p_deposit_cents: params.depositCents,
    p_expires_on: params.expiresOn,
    p_customer_notes: params.customerNotes
  });

  if (error) {
    throw new Error(`Unable to update the quote terms: ${error.message}`);
  }

  const result = okResultSchema.parse(data);
  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}

export async function transitionQuoteStatus(params: {
  quoteId: string;
  expectedStatus: QuoteStatus;
  nextStatus: QuoteStatus;
  reason?: string;
  expiresOn: string | null;
  actorRoles: readonly RoleCode[];
  today: string;
}) {
  const decision = canTransitionQuote({
    currentStatus: params.expectedStatus,
    nextStatus: params.nextStatus,
    actorRoles: params.actorRoles,
    reason: params.reason,
    expiresOn: params.expiresOn,
    today: params.today
  });

  if (!decision.allowed) {
    return { ok: false as const, message: decision.reason };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("transition_quote_status", {
    p_quote_id: params.quoteId,
    p_expected_status: params.expectedStatus,
    p_next_status: params.nextStatus,
    p_reason: params.reason?.trim() || null
  });

  if (error) {
    throw new Error(`Unable to update the quote: ${error.message}`);
  }

  const result = okResultSchema.parse(data);
  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}

function mapQuote(quote: QuoteRow, lineItems: QuoteLineItemRow[]): QuoteSummary {
  return {
    id: quote.id,
    reference: quote.reference,
    status: quote.status,
    leadId: quote.lead_id,
    leadReference: quote.leads?.reference ?? "Unknown lead",
    customerName: quote.customers
      ? `${quote.customers.first_name} ${quote.customers.last_name}`
      : "Unknown customer",
    customerEmail: quote.customers?.email ?? null,
    customerPhone: quote.customers?.phone ?? null,
    subtotalCents: quote.subtotal_cents,
    discountCents: quote.discount_cents,
    taxCents: quote.tax_cents,
    totalCents: quote.total_cents,
    depositCents: quote.deposit_cents,
    expiresOn: quote.expires_on,
    termsVersion: quote.terms_version,
    customerNotes: quote.customer_notes,
    decisionNotes: quote.decision_notes,
    sentAt: quote.sent_at,
    viewedAt: quote.viewed_at,
    acceptedAt: quote.accepted_at,
    rejectedAt: quote.rejected_at,
    createdAt: quote.created_at,
    lineItems: lineItems.map((item) => ({
      id: item.id,
      code: item.code,
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitAmountCents: item.unit_amount_cents,
      totalAmountCents: item.total_amount_cents,
      category: item.category
    }))
  };
}
