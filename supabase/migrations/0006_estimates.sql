-- Estimate generation: persist a calculated estimate with its line items.
-- Rollback note: pre-launch only, drop create_estimate_from_calculation and
-- restore the direct estimate write grants.

-- An estimate, its line items, and the lead status move together, so writes go
-- through the transactional function below instead of direct table grants.
revoke insert, update on estimates, estimate_line_items from authenticated;

create index if not exists estimates_lead_created_idx
  on estimates(lead_id, created_at desc);

create or replace function create_estimate_from_calculation(
  p_lead_id uuid,
  p_pricing_rule_version_id uuid,
  p_calculation jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  lead_row public.leads%rowtype;
  version_is_current boolean;
  crew_size integer;
  truck_count integer;
  estimated_minutes integer;
  travel_minutes integer;
  low_total integer;
  high_total integer;
  confidence text;
  line_item_total integer;
  line_item_count integer;
  transition_result jsonb;
  new_estimate_id uuid;
  new_estimate_reference text;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'estimator']) then
    raise exception using errcode = '42501', message = 'Not authorized to create estimates.';
  end if;

  select *
  into lead_row
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Lead not found.';
  end if;

  if lead_row.status not in ('qualified', 'estimate_pending') then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_LEAD_STATUS',
      'message', format('A lead must be qualified before it can be estimated, but it is %s.', lead_row.status)
    );
  end if;

  -- A retired or superseded version must not be attached to a new estimate,
  -- even though existing estimates keep pointing at theirs.
  select pr.is_active
    and (prv.effective_to is null or prv.effective_to > now())
  into version_is_current
  from public.pricing_rule_versions prv
  join public.pricing_rules pr on pr.id = prv.pricing_rule_id
  where prv.id = p_pricing_rule_version_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'PRICING_VERSION_NOT_FOUND',
      'message', 'The pricing rule version does not exist.'
    );
  end if;

  if not version_is_current then
    return jsonb_build_object(
      'ok', false,
      'code', 'PRICING_VERSION_RETIRED',
      'message', 'The pricing rule version is no longer active.'
    );
  end if;

  crew_size := (p_calculation->>'crewSize')::integer;
  truck_count := (p_calculation->>'truckCount')::integer;
  estimated_minutes := (p_calculation->>'estimatedMinutes')::integer;
  travel_minutes := coalesce((p_calculation->>'travelAllowanceMinutes')::integer, 0);
  low_total := (p_calculation->>'lowTotalCents')::integer;
  high_total := (p_calculation->>'highTotalCents')::integer;
  confidence := p_calculation->>'confidence';

  if crew_size is null or truck_count is null or estimated_minutes is null
    or low_total is null or high_total is null or confidence is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'INCOMPLETE_CALCULATION',
      'message', 'The calculation payload is missing required values.'
    );
  end if;

  if confidence not in ('high', 'medium', 'low') then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CONFIDENCE',
      'message', 'Confidence must be high, medium, or low.'
    );
  end if;

  select
    coalesce(sum((item->>'totalAmountCents')::integer), 0),
    count(*)
  into line_item_total, line_item_count
  from jsonb_array_elements(coalesce(p_calculation->'lineItems', '[]'::jsonb)) as item;

  if line_item_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'EMPTY_CALCULATION',
      'message', 'An estimate needs at least one line item.'
    );
  end if;

  -- The stored total must be reproducible from the stored line items, or the
  -- printable quote and the audit trail disagree with the price.
  if line_item_total <> low_total then
    return jsonb_build_object(
      'ok', false,
      'code', 'TOTAL_MISMATCH',
      'message', 'The line items do not add up to the estimate total.'
    );
  end if;

  insert into public.estimates (
    lead_id,
    customer_id,
    pricing_rule_version_id,
    status,
    suggested_crew_size,
    suggested_truck_count,
    estimated_minutes,
    travel_allowance_minutes,
    low_total_cents,
    high_total_cents,
    confidence,
    assumptions,
    warnings
  )
  values (
    p_lead_id,
    lead_row.customer_id,
    p_pricing_rule_version_id,
    'generated',
    crew_size,
    truck_count,
    estimated_minutes,
    travel_minutes,
    low_total,
    high_total,
    confidence,
    coalesce(p_calculation->'assumptions', '[]'::jsonb),
    coalesce(p_calculation->'warnings', '[]'::jsonb)
  )
  returning id, reference into new_estimate_id, new_estimate_reference;

  insert into public.estimate_line_items (
    estimate_id,
    code,
    description,
    quantity,
    unit,
    unit_amount_cents,
    total_amount_cents,
    category,
    sort_order
  )
  select
    new_estimate_id,
    item->>'code',
    item->>'description',
    (item->>'quantity')::numeric,
    item->>'unit',
    (item->>'unitAmountCents')::integer,
    (item->>'totalAmountCents')::integer,
    item->>'category',
    coalesce((item->>'sortOrder')::integer, ordinality::integer - 1)
  from jsonb_array_elements(p_calculation->'lineItems') with ordinality as entries(item, ordinality);

  if lead_row.status = 'qualified' then
    transition_result := public.transition_lead_status(
      p_lead_id,
      'qualified'::lead_status,
      'estimate_pending'::lead_status,
      null
    );

    -- The estimate rows are already written, so a refused transition has to
    -- roll the whole statement back rather than leave the lead behind.
    if not (transition_result->>'ok')::boolean then
      raise exception using
        errcode = '23514',
        message = coalesce(transition_result->>'message', 'The lead could not be moved to estimate_pending.');
    end if;
  end if;

  insert into public.lead_activities (
    lead_id,
    activity_type,
    outcome,
    created_by,
    metadata
  )
  values (
    p_lead_id,
    'estimate_generated',
    'Estimate ' || new_estimate_reference || ' generated',
    actor_id,
    jsonb_build_object('estimateId', new_estimate_id, 'confidence', confidence)
  );

  insert into public.audit_events (
    actor_profile_id,
    entity_type,
    entity_id,
    event_type,
    new_values
  )
  values (
    actor_id,
    'estimate',
    new_estimate_id,
    'estimate.created',
    jsonb_build_object(
      'leadId', p_lead_id,
      'pricingRuleVersionId', p_pricing_rule_version_id,
      'lowTotalCents', low_total,
      'highTotalCents', high_total,
      'confidence', confidence
    )
  );

  return jsonb_build_object(
    'ok', true,
    'estimateId', new_estimate_id,
    'reference', new_estimate_reference
  );
end;
$$;

revoke all on function create_estimate_from_calculation(uuid, uuid, jsonb)
  from public, anon;
grant execute on function create_estimate_from_calculation(uuid, uuid, jsonb)
  to authenticated;
