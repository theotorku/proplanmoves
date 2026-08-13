-- Close the direct-write paths left over from the Checkpoint 2 grants and make
-- the deterministic calculation the only way an estimate can be created.
-- Rollback note: pre-launch only, restore the 0002 grants and the previous
-- create_estimate_from_calculation signature.

-- Quotes, jobs, and audit rows are lifecycle records: acceptance, scheduling,
-- and the audit trail must be written by transactional functions, never by a
-- client that can set any column it likes. The read grants stay.
revoke insert, update on quotes, quote_line_items, jobs, audit_events
  from authenticated;

-- Marks an estimate whose amounts no longer follow from its pricing rule
-- version, so "priced by version X" stays a claim the data can support.
alter table estimates
  add column if not exists has_manual_adjustment boolean not null default false;

-- The previous signature relied on auth.uid(); the service-role caller has
-- none, so the actor is now passed and verified explicitly.
drop function if exists create_estimate_from_calculation(uuid, uuid, jsonb);

create or replace function create_estimate_from_calculation(
  p_actor_profile_id uuid,
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
  new_estimate_id uuid;
  new_estimate_reference text;
begin
  -- Callable only by the service role, so the application server is the only
  -- thing that can turn a calculation into an estimate. The acting staff
  -- member is still checked here so a compromised call cannot invent one.
  if p_actor_profile_id is null or not exists (
    select 1
    from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id
    join public.roles r on r.id = pr.role_id
    where p.id = p_actor_profile_id
      and p.is_active
      and r.code = any(array['owner', 'admin', 'estimator'])
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'FORBIDDEN',
      'message', 'The acting user cannot create estimates.'
    );
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

  -- transition_lead_status reads auth.uid(), which a service-role caller does
  -- not have, so the one transition this function performs is written here
  -- with the same activity and audit records it would have produced.
  if lead_row.status = 'qualified' then
    update public.leads
    set status = 'estimate_pending', updated_at = now()
    where id = p_lead_id;

    insert into public.lead_activities (
      lead_id,
      activity_type,
      outcome,
      created_by,
      metadata
    )
    values (
      p_lead_id,
      'status_changed',
      'qualified -> estimate_pending',
      p_actor_profile_id,
      jsonb_build_object('reason', null)
    );

    insert into public.audit_events (
      actor_profile_id,
      entity_type,
      entity_id,
      event_type,
      previous_values,
      new_values
    )
    values (
      p_actor_profile_id,
      'lead',
      p_lead_id,
      'lead.status_changed',
      jsonb_build_object('status', 'qualified'),
      jsonb_build_object('status', 'estimate_pending', 'reason', null)
    );
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
    p_actor_profile_id,
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
    p_actor_profile_id,
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

revoke all on function create_estimate_from_calculation(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function create_estimate_from_calculation(uuid, uuid, uuid, jsonb)
  to service_role;

-- An override is a deliberate, audited human decision, so it stays available
-- to staff. It now flags the estimate as no longer derived from its version.
create or replace function update_estimate_line_item(
  p_line_item_id uuid,
  p_quantity numeric,
  p_unit_amount_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  target_estimate_id uuid;
  current_status estimate_status;
  previous_quantity numeric;
  previous_unit_amount integer;
  previous_low integer;
  previous_high integer;
  new_total numeric;
  new_low integer;
  new_high integer;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'estimator']) then
    raise exception using errcode = '42501', message = 'Not authorized to edit estimates.';
  end if;

  if p_quantity is null or p_quantity < 0 or p_unit_amount_cents is null or p_unit_amount_cents < 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_AMOUNT',
      'message', 'Quantity and unit amount must be zero or greater.'
    );
  end if;

  select li.estimate_id, li.quantity, li.unit_amount_cents
  into target_estimate_id, previous_quantity, previous_unit_amount
  from public.estimate_line_items li
  where li.id = p_line_item_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Estimate line item not found.';
  end if;

  select status, low_total_cents, high_total_cents
  into current_status, previous_low, previous_high
  from public.estimates
  where id = target_estimate_id
  for update;

  if current_status in ('approved', 'rejected') then
    return jsonb_build_object(
      'ok', false,
      'code', 'ESTIMATE_CLOSED',
      'message', format('A %s estimate cannot be edited; generate a new one instead.', current_status)
    );
  end if;

  new_total := round(p_quantity * p_unit_amount_cents);

  if new_total > 99999999 then
    return jsonb_build_object(
      'ok', false,
      'code', 'AMOUNT_TOO_LARGE',
      'message', 'A single line cannot exceed $999,999.99; split it or record it as a separate job.'
    );
  end if;

  update public.estimate_line_items
  set
    quantity = p_quantity,
    unit_amount_cents = p_unit_amount_cents,
    total_amount_cents = new_total::integer
  where id = p_line_item_id;

  select coalesce(sum(total_amount_cents), 0)
  into new_low
  from public.estimate_line_items
  where estimate_id = target_estimate_id;

  new_high := case
    when previous_low > 0 then round(new_low::numeric * previous_high / previous_low)::integer
    else new_low
  end;

  update public.estimates
  set
    low_total_cents = new_low,
    high_total_cents = greatest(new_high, new_low),
    has_manual_adjustment = true,
    updated_at = now()
  where id = target_estimate_id;

  insert into public.audit_events (
    actor_profile_id,
    entity_type,
    entity_id,
    event_type,
    previous_values,
    new_values
  )
  values (
    actor_id,
    'estimate',
    target_estimate_id,
    'estimate.line_item_updated',
    jsonb_build_object(
      'lineItemId', p_line_item_id,
      'quantity', previous_quantity,
      'unitAmountCents', previous_unit_amount,
      'lowTotalCents', previous_low
    ),
    jsonb_build_object(
      'lineItemId', p_line_item_id,
      'quantity', p_quantity,
      'unitAmountCents', p_unit_amount_cents,
      'lowTotalCents', new_low
    )
  );

  return jsonb_build_object(
    'ok', true,
    'lowTotalCents', new_low,
    'highTotalCents', greatest(new_high, new_low)
  );
end;
$$;

revoke all on function update_estimate_line_item(uuid, numeric, integer)
  from public, anon;
grant execute on function update_estimate_line_item(uuid, numeric, integer)
  to authenticated;
