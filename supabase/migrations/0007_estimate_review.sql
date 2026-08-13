-- Estimate review and line-item overrides.
-- Rollback note: pre-launch only, drop review_estimate and
-- update_estimate_line_item.

-- Reviewing an estimate is a separation-of-duties step: an estimator prepares
-- and submits a price, an owner or admin accepts it.
create or replace function review_estimate(
  p_estimate_id uuid,
  p_expected_status estimate_status,
  p_next_status estimate_status,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  actor_is_manager boolean;
  current_status estimate_status;
  estimate_lead_id uuid;
  estimate_reference text;
  normalized_reason text := nullif(trim(p_reason), '');
  transition_allowed boolean;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'estimator']) then
    raise exception using errcode = '42501', message = 'Not authorized to review estimates.';
  end if;

  actor_is_manager := public.has_any_role(array['owner', 'admin']);

  select status, lead_id, reference
  into current_status, estimate_lead_id, estimate_reference
  from public.estimates
  where id = p_estimate_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Estimate not found.';
  end if;

  if current_status <> p_expected_status then
    return jsonb_build_object(
      'ok', false,
      'code', 'STALE_STATUS',
      'message', 'The estimate status changed before this request completed.'
    );
  end if;

  if current_status = p_next_status then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  transition_allowed := case current_status
    when 'draft' then p_next_status in ('generated', 'under_review')
    when 'generated' then p_next_status = 'under_review'
    when 'under_review' then p_next_status in ('approved', 'rejected')
    when 'rejected' then p_next_status = 'under_review'
    else false
  end;

  if not transition_allowed then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_TRANSITION',
      'message', format('Cannot move an estimate from %s to %s.', current_status, p_next_status)
    );
  end if;

  if p_next_status in ('approved', 'rejected') and not actor_is_manager then
    return jsonb_build_object(
      'ok', false,
      'code', 'FORBIDDEN',
      'message', 'Only an owner or admin can approve or reject an estimate.'
    );
  end if;

  if p_next_status = 'rejected' and normalized_reason is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'REASON_REQUIRED',
      'message', 'A reason is required to reject an estimate.'
    );
  end if;

  update public.estimates
  set
    status = p_next_status,
    reviewed_by = case
      when p_next_status in ('approved', 'rejected') then actor_id
      else reviewed_by
    end,
    reviewed_at = case
      when p_next_status in ('approved', 'rejected') then now()
      else reviewed_at
    end,
    updated_at = now()
  where id = p_estimate_id;

  insert into public.lead_activities (
    lead_id,
    activity_type,
    outcome,
    created_by,
    metadata
  )
  values (
    estimate_lead_id,
    'estimate_reviewed',
    estimate_reference || ': ' || current_status::text || ' -> ' || p_next_status::text,
    actor_id,
    jsonb_build_object('estimateId', p_estimate_id, 'reason', normalized_reason)
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
    actor_id,
    'estimate',
    p_estimate_id,
    'estimate.status_changed',
    jsonb_build_object('status', current_status),
    jsonb_build_object('status', p_next_status, 'reason', normalized_reason)
  );

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

revoke all on function review_estimate(uuid, estimate_status, estimate_status, text)
  from public, anon;
grant execute on function review_estimate(uuid, estimate_status, estimate_status, text)
  to authenticated;

-- Operators override a calculated line when local knowledge beats the rules.
-- The estimate total is recomputed from the stored lines so the two can never
-- drift apart, and the confidence-based spread is preserved.
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

  -- Keep the uncertainty spread the calculation produced. Its width reflects
  -- how much is unknown about the move, which an amount override does not change.
  new_high := case
    when previous_low > 0 then round(new_low::numeric * previous_high / previous_low)::integer
    else new_low
  end;

  update public.estimates
  set
    low_total_cents = new_low,
    high_total_cents = greatest(new_high, new_low),
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
