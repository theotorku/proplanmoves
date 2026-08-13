import { z } from "zod";
import { createSupabaseServerClient } from "@/domains/auth/server";
import {
  calculateEstimate,
  type EstimateCalculation,
  type EstimateCalculationInput
} from "./calculate";
import { parsePricingRules, type MoveType, type PricingRules } from "./pricing-rules";
import { canReviewEstimate, type EstimateStatus } from "./status";
import type { RoleCode } from "@/domains/auth/roles";

export type ActivePricingRuleVersion = {
  id: string;
  versionNumber: number;
  rules: PricingRules;
};

export type EstimateSummary = {
  id: string;
  reference: string;
  status: string;
  crewSize: number;
  truckCount: number;
  estimatedMinutes: number;
  travelAllowanceMinutes: number;
  lowTotalCents: number;
  highTotalCents: number;
  confidence: string;
  assumptions: string[];
  warnings: string[];
  reviewedAt: string | null;
  createdAt: string;
  lineItems: EstimateSummaryLineItem[];
};

export type EstimateSummaryLineItem = {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitAmountCents: number;
  totalAmountCents: number;
  category: string;
};

type PricingVersionRow = {
  id: string;
  version_number: number;
  rules_json: unknown;
};

export type LeadCalculationRow = {
  id: string;
  status: string;
  move_type: MoveType;
  bedroom_count: number | null;
  estimated_boxes: number | null;
  needs_packing: boolean;
  needs_storage: boolean;
  origin_floor: number | null;
  destination_floor: number | null;
  origin_has_elevator: boolean | null;
  destination_has_elevator: boolean | null;
  specialty_items: unknown;
  requested_move_date: string | null;
};

type EstimateRow = {
  id: string;
  reference: string;
  status: string;
  suggested_crew_size: number;
  suggested_truck_count: number;
  estimated_minutes: number;
  travel_allowance_minutes: number;
  low_total_cents: number;
  high_total_cents: number;
  confidence: string;
  assumptions: unknown;
  warnings: unknown;
  reviewed_at: string | null;
  created_at: string;
};

type EstimateLineItemRow = {
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

const stringArraySchema = z.array(z.string()).catch([]);

/**
 * The newest version of the active pricing rule that is in force right now.
 * Estimates always reference the version they were priced with, so this is
 * only used when a new estimate is generated.
 */
export async function getActivePricingRuleVersion(): Promise<ActivePricingRuleVersion | null> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("pricing_rule_versions")
    .select("id, version_number, rules_json, pricing_rules!inner(is_active)")
    .eq("pricing_rules.is_active", true)
    .lte("effective_from", nowIso)
    .or(`effective_to.is.null,effective_to.gt.${nowIso}`)
    .order("version_number", { ascending: false })
    .limit(1)
    .returns<PricingVersionRow[]>();

  if (error) {
    throw new Error(`Unable to load pricing rules: ${error.message}`);
  }

  const version = data?.[0];

  if (!version) {
    return null;
  }

  return {
    id: version.id,
    versionNumber: version.version_number,
    rules: parsePricingRules(version.rules_json)
  };
}

export async function generateEstimateForLead(params: {
  leadId: string;
  /** ISO calendar date used for past-move-date warnings. */
  today: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "id, status, move_type, bedroom_count, estimated_boxes, needs_packing, needs_storage, origin_floor, destination_floor, origin_has_elevator, destination_has_elevator, specialty_items, requested_move_date"
    )
    .eq("id", params.leadId)
    .maybeSingle()
    .returns<LeadCalculationRow | null>();

  if (leadError) {
    throw new Error(`Unable to load lead: ${leadError.message}`);
  }

  if (!lead) {
    return { ok: false as const, message: "The lead could not be found." };
  }

  const version = await getActivePricingRuleVersion();

  if (!version) {
    return {
      ok: false as const,
      message: "No active pricing rule version is available. Publish one before estimating."
    };
  }

  const calculation = calculateEstimate(toCalculationInput(lead, params.today), version.rules);

  const { data, error } = await supabase.rpc("create_estimate_from_calculation", {
    p_lead_id: params.leadId,
    p_pricing_rule_version_id: version.id,
    p_calculation: toCalculationPayload(calculation)
  });

  if (error) {
    throw new Error(`Unable to save the estimate: ${error.message}`);
  }

  const result = z
    .discriminatedUnion("ok", [
      z.object({
        ok: z.literal(true),
        estimateId: z.string().uuid(),
        reference: z.string()
      }),
      z.object({
        ok: z.literal(false),
        code: z.string(),
        message: z.string()
      })
    ])
    .parse(data);

  return result.ok
    ? { ok: true as const, estimateId: result.estimateId, reference: result.reference }
    : { ok: false as const, message: result.message };
}

export async function getLatestEstimateForLead(leadId: string): Promise<EstimateSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data: estimate, error } = await supabase
    .from("estimates")
    .select(
      "id, reference, status, suggested_crew_size, suggested_truck_count, estimated_minutes, travel_allowance_minutes, low_total_cents, high_total_cents, confidence, assumptions, warnings, reviewed_at, created_at"
    )
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .returns<EstimateRow | null>();

  if (error) {
    throw new Error(`Unable to load the estimate: ${error.message}`);
  }

  if (!estimate) {
    return null;
  }

  const { data: lineItems, error: lineItemError } = await supabase
    .from("estimate_line_items")
    .select(
      "id, code, description, quantity, unit, unit_amount_cents, total_amount_cents, category, sort_order"
    )
    .eq("estimate_id", estimate.id)
    .order("sort_order", { ascending: true })
    .returns<EstimateLineItemRow[]>();

  if (lineItemError) {
    throw new Error(`Unable to load the estimate line items: ${lineItemError.message}`);
  }

  return {
    id: estimate.id,
    reference: estimate.reference,
    status: estimate.status,
    crewSize: estimate.suggested_crew_size,
    truckCount: estimate.suggested_truck_count,
    estimatedMinutes: estimate.estimated_minutes,
    travelAllowanceMinutes: estimate.travel_allowance_minutes,
    lowTotalCents: estimate.low_total_cents,
    highTotalCents: estimate.high_total_cents,
    confidence: estimate.confidence,
    assumptions: stringArraySchema.parse(estimate.assumptions),
    warnings: stringArraySchema.parse(estimate.warnings),
    reviewedAt: estimate.reviewed_at,
    createdAt: estimate.created_at,
    lineItems: (lineItems ?? []).map((item) => ({
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

export async function reviewEstimate(params: {
  estimateId: string;
  expectedStatus: EstimateStatus;
  nextStatus: EstimateStatus;
  reason?: string;
  actorRoles: readonly RoleCode[];
}) {
  const decision = canReviewEstimate(
    params.expectedStatus,
    params.nextStatus,
    params.actorRoles,
    params.reason
  );

  if (!decision.allowed) {
    return { ok: false as const, message: decision.reason };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("review_estimate", {
    p_estimate_id: params.estimateId,
    p_expected_status: params.expectedStatus,
    p_next_status: params.nextStatus,
    p_reason: params.reason?.trim() || null
  });

  if (error) {
    throw new Error(`Unable to review the estimate: ${error.message}`);
  }

  const result = z
    .discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), changed: z.boolean() }),
      z.object({ ok: z.literal(false), code: z.string(), message: z.string() })
    ])
    .parse(data);

  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}

export async function updateEstimateLineItem(params: {
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
  const { data, error } = await supabase.rpc("update_estimate_line_item", {
    p_line_item_id: params.lineItemId,
    p_quantity: params.quantity,
    p_unit_amount_cents: params.unitAmountCents
  });

  if (error) {
    throw new Error(`Unable to update the line item: ${error.message}`);
  }

  const result = z
    .discriminatedUnion("ok", [
      z.object({
        ok: z.literal(true),
        lowTotalCents: z.number().int(),
        highTotalCents: z.number().int()
      }),
      z.object({ ok: z.literal(false), code: z.string(), message: z.string() })
    ])
    .parse(data);

  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}

export function toCalculationInput(
  lead: LeadCalculationRow,
  today: string
): EstimateCalculationInput {
  return {
    moveType: lead.move_type,
    bedroomCount: lead.bedroom_count,
    estimatedBoxes: lead.estimated_boxes,
    needsPacking: lead.needs_packing,
    needsStorage: lead.needs_storage,
    originFloor: lead.origin_floor,
    destinationFloor: lead.destination_floor,
    originHasElevator: lead.origin_has_elevator,
    destinationHasElevator: lead.destination_has_elevator,
    specialtyItems: stringArraySchema.parse(lead.specialty_items),
    requestedMoveDate: lead.requested_move_date,
    today
  };
}

/** The payload contract enforced by `create_estimate_from_calculation`. */
export function toCalculationPayload(calculation: EstimateCalculation) {
  return {
    crewSize: calculation.crewSize,
    truckCount: calculation.truckCount,
    estimatedMinutes: calculation.estimatedMinutes,
    travelAllowanceMinutes: calculation.travelAllowanceMinutes,
    lowTotalCents: calculation.lowTotalCents,
    highTotalCents: calculation.highTotalCents,
    confidence: calculation.confidence,
    assumptions: calculation.assumptions,
    warnings: calculation.warnings,
    lineItems: calculation.lineItems.map((item) => ({
      code: item.code,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitAmountCents: item.unitAmountCents,
      totalAmountCents: item.totalAmountCents,
      category: item.category,
      sortOrder: item.sortOrder
    }))
  };
}
