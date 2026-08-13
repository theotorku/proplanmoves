-- Quote conversion, editing, and lifecycle.
-- Rollback note: pre-launch only, drop the functions below and the
-- quotes.decision_notes column.

-- Why an accepted or rejected quote reached that state. The lead's own
-- lost/won reasons stay on the lead.
alter table quotes
  add column if not exists decision_notes text;

create index if not exists quotes_lead_created_idx on quotes(lead_id, created_at desc);
create index if not exists quotes_estimate_idx on quotes(estimate_id);

-- Totals are always derived from the stored line items, never accepted from a
-- caller. Discount and deposit are clamped so the table's arithmetic and
-- deposit constraints hold even when lines are removed or reduced.
create or replace function recalculate_quote_totals(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  quote_row public.quotes%rowtype;
  new_subtotal integer;
  new_discount integer;
  new_total integer;
  new_deposit integer;
begin
  select * into quote_row from public.quotes where id = p_quote_id;

  select coalesce(sum(total_amount_cents), 0)
  into new_subtotal
  from public.quote_line_items
  where quote_id = p_quote_id;

  new_discount := least(quote_row.discount_cents, new_subtotal);
  new_total := new_subtotal - new_discount + quote_row.tax_cents;
  new_deposit := least(quote_row.deposit_cents, new_total);

  update public.quotes
  set
    subtotal_cents = new_subtotal,
    discount_cents = new_discount,
    total_cents = new_total,
    deposit_cents = new_deposit,
    updated_at = now()
  where id = p_quote_id;

  return jsonb_build_object(
    'subtotalCents', new_subtotal,
    'discountCents', new_discount,
    'taxCents', quote_row.tax_cents,
    'totalCents', new_total,
    'depositCents', new_deposit
  );
end;
$$;

revoke all on function recalculate_quote_totals(uuid) from public, anon, authenticated;

-- Conversion copies an approved estimate; the caller supplies no amounts, so
-- staff can run it directly without being able to invent a price.
create or replace function create_quote_from_estimate(
  p_estimate_id uuid,
  p_expires_on date default null,
  p_terms_version text default 'terms-v1'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  estimate_row public.estimates%rowtype;
  lead_status_now lead_status;
  transition_result jsonb;
  new_quote_id uuid;
  new_quote_reference text;
  totals jsonb;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'estimator']) then
    raise exception using errcode = '42501', message = 'Not authorized to create quotes.';
  end if;

  select * into estimate_row
  from public.estimates
  where id = p_estimate_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Estimate not found.';
  end if;

  if estimate_row.status <> 'approved' then
    return jsonb_build_object(
      'ok', false,
      'code', 'ESTIMATE_NOT_APPROVED',
      'message', format('Only an approved estimate can become a quote, but this one is %s.', estimate_row.status)
    );
  end if;

  -- One live quote per estimate. Re-quoting means rejecting, expiring, or
  -- cancelling the current one first, so two open prices never circulate.
  if exists (
    select 1
    from public.quotes
    where estimate_id = p_estimate_id
      and status not in ('rejected', 'expired', 'cancelled')
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'QUOTE_EXISTS',
      'message', 'This estimate already has a live quote.'
    );
  end if;

  insert into public.quotes (
    estimate_id,
    lead_id,
    customer_id,
    status,
    subtotal_cents,
    total_cents,
    expires_on,
    terms_version
  )
  values (
    p_estimate_id,
    estimate_row.lead_id,
    estimate_row.customer_id,
    'draft',
    0,
    0,
    coalesce(p_expires_on, (current_date + 14)),
    p_terms_version
  )
  returning id, reference into new_quote_id, new_quote_reference;

  insert into public.quote_line_items (
    quote_id,
    source_estimate_line_item_id,
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
    new_quote_id,
    li.id,
    li.code,
    li.description,
    li.quantity,
    li.unit,
    li.unit_amount_cents,
    li.total_amount_cents,
    li.category,
    li.sort_order
  from public.estimate_line_items li
  where li.estimate_id = p_estimate_id;

  totals := public.recalculate_quote_totals(new_quote_id);

  select status into lead_status_now
  from public.leads
  where id = estimate_row.lead_id
  for update;

  if lead_status_now = 'estimate_pending' then
    transition_result := public.transition_lead_status(
      estimate_row.lead_id,
      'estimate_pending'::lead_status,
      'quote_pending'::lead_status,
      null
    );

    if not (transition_result->>'ok')::boolean then
      raise exception using
        errcode = '23514',
        message = coalesce(transition_result->>'message', 'The lead could not be moved to quote_pending.');
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
    estimate_row.lead_id,
    'quote_created',
    'Quote ' || new_quote_reference || ' created',
    actor_id,
    jsonb_build_object('quoteId', new_quote_id, 'estimateId', p_estimate_id)
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
    'quote',
    new_quote_id,
    'quote.created',
    jsonb_build_object(
      'estimateId', p_estimate_id,
      'leadId', estimate_row.lead_id,
      'totals', totals
    )
  );

  return jsonb_build_object(
    'ok', true,
    'quoteId', new_quote_id,
    'reference', new_quote_reference,
    'totals', totals
  );
end;
$$;

revoke all on function create_quote_from_estimate(uuid, date, text) from public, anon;
grant execute on function create_quote_from_estimate(uuid, date, text) to authenticated;

create or replace function update_quote_line_item(
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
  target_quote_id uuid;
  current_status quote_status;
  previous_quantity numeric;
  previous_unit_amount integer;
  new_total numeric;
  totals jsonb;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'estimator']) then
    raise exception using errcode = '42501', message = 'Not authorized to edit quotes.';
  end if;

  if p_quantity is null or p_quantity < 0 or p_unit_amount_cents is null or p_unit_amount_cents < 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_AMOUNT',
      'message', 'Quantity and unit amount must be zero or greater.'
    );
  end if;

  select quote_id, quantity, unit_amount_cents
  into target_quote_id, previous_quantity, previous_unit_amount
  from public.quote_line_items
  where id = p_line_item_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Quote line item not found.';
  end if;

  select status into current_status
  from public.quotes
  where id = target_quote_id
  for update;

  -- Once a quote has been sent, its numbers are what the customer is looking
  -- at. Changing them means issuing a new quote.
  if current_status not in ('draft', 'ready') then
    return jsonb_build_object(
      'ok', false,
      'code', 'QUOTE_LOCKED',
      'message', format('A %s quote cannot be edited; create a new quote instead.', current_status)
    );
  end if;

  new_total := round(p_quantity * p_unit_amount_cents);

  if new_total > 99999999 then
    return jsonb_build_object(
      'ok', false,
      'code', 'AMOUNT_TOO_LARGE',
      'message', 'A single line cannot exceed $999,999.99.'
    );
  end if;

  update public.quote_line_items
  set
    quantity = p_quantity,
    unit_amount_cents = p_unit_amount_cents,
    total_amount_cents = new_total::integer
  where id = p_line_item_id;

  totals := public.recalculate_quote_totals(target_quote_id);

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
    'quote',
    target_quote_id,
    'quote.line_item_updated',
    jsonb_build_object(
      'lineItemId', p_line_item_id,
      'quantity', previous_quantity,
      'unitAmountCents', previous_unit_amount
    ),
    jsonb_build_object(
      'lineItemId', p_line_item_id,
      'quantity', p_quantity,
      'unitAmountCents', p_unit_amount_cents,
      'totals', totals
    )
  );

  return jsonb_build_object('ok', true, 'totals', totals);
end;
$$;

revoke all on function update_quote_line_item(uuid, numeric, integer) from public, anon;
grant execute on function update_quote_line_item(uuid, numeric, integer) to authenticated;

-- Discount, tax, deposit, validity, and customer-facing notes are commercial
-- decisions, so they are entered rather than derived. The arithmetic that ties
-- them to the line items is still enforced here.
create or replace function update_quote_terms(
  p_quote_id uuid,
  p_discount_cents integer,
  p_tax_cents integer,
  p_deposit_cents integer,
  p_expires_on date,
  p_customer_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  quote_row public.quotes%rowtype;
  new_total integer;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'estimator']) then
    raise exception using errcode = '42501', message = 'Not authorized to edit quotes.';
  end if;

  select * into quote_row
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Quote not found.';
  end if;

  if quote_row.status not in ('draft', 'ready') then
    return jsonb_build_object(
      'ok', false,
      'code', 'QUOTE_LOCKED',
      'message', format('A %s quote cannot be edited; create a new quote instead.', quote_row.status)
    );
  end if;

  if p_discount_cents is null or p_discount_cents < 0
    or p_tax_cents is null or p_tax_cents < 0
    or p_deposit_cents is null or p_deposit_cents < 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_AMOUNT',
      'message', 'Discount, tax, and deposit must be zero or greater.'
    );
  end if;

  if p_discount_cents > quote_row.subtotal_cents then
    return jsonb_build_object(
      'ok', false,
      'code', 'DISCOUNT_TOO_LARGE',
      'message', 'A discount cannot exceed the quote subtotal.'
    );
  end if;

  new_total := quote_row.subtotal_cents - p_discount_cents + p_tax_cents;

  if p_deposit_cents > new_total then
    return jsonb_build_object(
      'ok', false,
      'code', 'DEPOSIT_TOO_LARGE',
      'message', 'A deposit cannot exceed the quote total.'
    );
  end if;

  if p_expires_on is not null and p_expires_on < current_date then
    return jsonb_build_object(
      'ok', false,
      'code', 'EXPIRY_IN_PAST',
      'message', 'A quote cannot be set to expire in the past.'
    );
  end if;

  update public.quotes
  set
    discount_cents = p_discount_cents,
    tax_cents = p_tax_cents,
    deposit_cents = p_deposit_cents,
    total_cents = new_total,
    expires_on = p_expires_on,
    customer_notes = nullif(trim(coalesce(p_customer_notes, '')), ''),
    updated_at = now()
  where id = p_quote_id;

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
    'quote',
    p_quote_id,
    'quote.terms_updated',
    jsonb_build_object(
      'discountCents', quote_row.discount_cents,
      'taxCents', quote_row.tax_cents,
      'depositCents', quote_row.deposit_cents,
      'expiresOn', quote_row.expires_on
    ),
    jsonb_build_object(
      'discountCents', p_discount_cents,
      'taxCents', p_tax_cents,
      'depositCents', p_deposit_cents,
      'expiresOn', p_expires_on,
      'totalCents', new_total
    )
  );

  return jsonb_build_object('ok', true, 'totalCents', new_total);
end;
$$;

revoke all on function update_quote_terms(uuid, integer, integer, integer, date, text)
  from public, anon;
grant execute on function update_quote_terms(uuid, integer, integer, integer, date, text)
  to authenticated;

create or replace function transition_quote_status(
  p_quote_id uuid,
  p_expected_status quote_status,
  p_next_status quote_status,
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
  quote_row public.quotes%rowtype;
  normalized_reason text := nullif(trim(p_reason), '');
  transition_allowed boolean;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'estimator']) then
    raise exception using errcode = '42501', message = 'Not authorized to update quotes.';
  end if;

  actor_is_manager := public.has_any_role(array['owner', 'admin']);

  select * into quote_row
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Quote not found.';
  end if;

  if quote_row.status <> p_expected_status then
    return jsonb_build_object(
      'ok', false,
      'code', 'STALE_STATUS',
      'message', 'The quote status changed before this request completed.'
    );
  end if;

  if quote_row.status = p_next_status then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  transition_allowed := case quote_row.status
    when 'draft' then p_next_status in ('ready', 'cancelled')
    when 'ready' then p_next_status in ('sent', 'draft', 'cancelled')
    when 'sent' then p_next_status in ('viewed', 'accepted', 'rejected', 'expired', 'cancelled')
    when 'viewed' then p_next_status in ('accepted', 'rejected', 'expired', 'cancelled')
    when 'accepted' then p_next_status = 'cancelled'
    else false
  end;

  if not transition_allowed then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_TRANSITION',
      'message', format('Cannot move a quote from %s to %s.', quote_row.status, p_next_status)
    );
  end if;

  -- Reversing a commitment the customer already accepted is an override, and
  -- it has to be explained.
  if quote_row.status = 'accepted' and p_next_status = 'cancelled' then
    if not actor_is_manager then
      return jsonb_build_object(
        'ok', false,
        'code', 'FORBIDDEN',
        'message', 'Only an owner or admin can cancel an accepted quote.'
      );
    end if;

    if normalized_reason is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'REASON_REQUIRED',
        'message', 'Cancelling an accepted quote requires a reason.'
      );
    end if;
  end if;

  if p_next_status = 'rejected' and normalized_reason is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'REASON_REQUIRED',
      'message', 'A reason is required to record a rejection.'
    );
  end if;

  -- Expiry is driven by the date but never happens silently: someone or some
  -- job records it, and only once the quote is actually past its date.
  if p_next_status = 'expired'
    and (quote_row.expires_on is null or quote_row.expires_on >= current_date) then
    return jsonb_build_object(
      'ok', false,
      'code', 'NOT_EXPIRED',
      'message', 'This quote has not reached its expiry date.'
    );
  end if;

  update public.quotes
  set
    status = p_next_status,
    sent_at = case when p_next_status = 'sent' then now() else sent_at end,
    viewed_at = case when p_next_status = 'viewed' then now() else viewed_at end,
    accepted_at = case when p_next_status = 'accepted' then now() else accepted_at end,
    rejected_at = case when p_next_status = 'rejected' then now() else rejected_at end,
    decision_notes = case
      when p_next_status in ('accepted', 'rejected', 'cancelled') then normalized_reason
      else decision_notes
    end,
    updated_at = now()
  where id = p_quote_id;

  insert into public.lead_activities (
    lead_id,
    activity_type,
    outcome,
    created_by,
    metadata
  )
  values (
    quote_row.lead_id,
    'quote_status_changed',
    quote_row.reference || ': ' || quote_row.status::text || ' -> ' || p_next_status::text,
    actor_id,
    jsonb_build_object('quoteId', p_quote_id, 'reason', normalized_reason)
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
    'quote',
    p_quote_id,
    'quote.status_changed',
    jsonb_build_object('status', quote_row.status),
    jsonb_build_object('status', p_next_status, 'reason', normalized_reason)
  );

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

revoke all on function transition_quote_status(uuid, quote_status, quote_status, text)
  from public, anon;
grant execute on function transition_quote_status(uuid, quote_status, quote_status, text)
  to authenticated;
