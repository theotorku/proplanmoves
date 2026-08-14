-- Keeps the quote and job records from contradicting each other, and stops work
-- being booked into the past by accident.
-- Rollback note: pre-launch only, restore the 0009 and 0010 function bodies.

-- A cancelled quote with a live job underneath it is the worst kind of wrong:
-- the commercial record says the work is off while dispatch still has a crew
-- committed. The job is dispatch's record, so this refuses rather than
-- cancelling it on their behalf.
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
  blocking_job_reference text;
  blocking_job_status job_status;
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

  if p_next_status = 'cancelled' then
    select j.reference, j.status
    into blocking_job_reference, blocking_job_status
    from public.jobs j
    where j.quote_id = p_quote_id
      and j.status <> 'cancelled'
    limit 1;

    if found then
      return jsonb_build_object(
        'ok', false,
        'code', 'JOB_EXISTS',
        'message', format(
          'Job %s is still %s. Cancel the job first so dispatch and the customer record agree.',
          blocking_job_reference,
          blocking_job_status
        )
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

-- A job dated before today is invisible on the upcoming board, so an accidental
-- past date is an easy way to lose a move. Backfilling a historical job is a
-- real need, so owners and admins may do it and the audit record says so.
create or replace function create_job_from_quote(
  p_quote_id uuid,
  p_scheduled_date date default null,
  p_arrival_window_start time default null,
  p_arrival_window_end time default null
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
  estimate_row public.estimates%rowtype;
  lead_row public.leads%rowtype;
  existing_job_id uuid;
  existing_job_reference text;
  new_status job_status;
  new_job_id uuid;
  new_job_reference text;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'dispatcher']) then
    raise exception using errcode = '42501', message = 'Not authorized to create jobs.';
  end if;

  actor_is_manager := public.has_any_role(array['owner', 'admin']);

  select * into quote_row
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Quote not found.';
  end if;

  select id, reference
  into existing_job_id, existing_job_reference
  from public.jobs
  where quote_id = p_quote_id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'created', false,
      'jobId', existing_job_id,
      'reference', existing_job_reference
    );
  end if;

  if quote_row.status <> 'accepted' then
    return jsonb_build_object(
      'ok', false,
      'code', 'QUOTE_NOT_ACCEPTED',
      'message', format('Only an accepted quote can become a job, but this one is %s.', quote_row.status)
    );
  end if;

  if (p_scheduled_date is null) <> (p_arrival_window_start is null)
    or (p_arrival_window_start is null) <> (p_arrival_window_end is null) then
    return jsonb_build_object(
      'ok', false,
      'code', 'INCOMPLETE_SCHEDULE',
      'message', 'A scheduled job needs a date and both ends of its arrival window.'
    );
  end if;

  if p_arrival_window_end is not null and p_arrival_window_end <= p_arrival_window_start then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_WINDOW',
      'message', 'The arrival window must end after it starts.'
    );
  end if;

  if p_scheduled_date is not null and p_scheduled_date < current_date and not actor_is_manager then
    return jsonb_build_object(
      'ok', false,
      'code', 'SCHEDULE_IN_PAST',
      'message', 'A job cannot be booked into the past. An owner or admin can record a historical date.'
    );
  end if;

  select * into estimate_row from public.estimates where id = quote_row.estimate_id;
  select * into lead_row from public.leads where id = quote_row.lead_id for update;

  new_status := case when p_scheduled_date is null then 'unscheduled' else 'scheduled' end;

  insert into public.jobs (
    customer_id,
    lead_id,
    estimate_id,
    quote_id,
    status,
    scheduled_date,
    arrival_window_start,
    arrival_window_end,
    origin_address_id,
    destination_address_id,
    crew_size,
    truck_count,
    estimated_duration_minutes,
    estimated_revenue_cents,
    customer_notes
  )
  values (
    quote_row.customer_id,
    quote_row.lead_id,
    quote_row.estimate_id,
    p_quote_id,
    new_status,
    p_scheduled_date,
    p_arrival_window_start,
    p_arrival_window_end,
    lead_row.origin_address_id,
    lead_row.destination_address_id,
    estimate_row.suggested_crew_size,
    estimate_row.suggested_truck_count,
    estimate_row.estimated_minutes,
    quote_row.total_cents,
    quote_row.customer_notes
  )
  returning id, reference into new_job_id, new_job_reference;

  if lead_row.status = 'quote_pending' then
    update public.leads
    set status = 'won', updated_at = now()
    where id = lead_row.id;

    insert into public.lead_activities (
      lead_id,
      activity_type,
      outcome,
      created_by,
      metadata
    )
    values (
      lead_row.id,
      'status_changed',
      'quote_pending -> won',
      actor_id,
      jsonb_build_object('jobId', new_job_id)
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
      'lead',
      lead_row.id,
      'lead.status_changed',
      jsonb_build_object('status', 'quote_pending'),
      jsonb_build_object('status', 'won', 'jobId', new_job_id)
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
    lead_row.id,
    'job_created',
    'Job ' || new_job_reference || ' created',
    actor_id,
    jsonb_build_object('jobId', new_job_id, 'quoteId', p_quote_id)
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
    'job',
    new_job_id,
    'job.created',
    jsonb_build_object(
      'quoteId', p_quote_id,
      'leadId', lead_row.id,
      'status', new_status,
      'estimatedRevenueCents', quote_row.total_cents,
      'backdated', p_scheduled_date is not null and p_scheduled_date < current_date
    )
  );

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'jobId', new_job_id,
    'reference', new_job_reference
  );
end;
$$;

revoke all on function create_job_from_quote(uuid, date, time, time) from public, anon;
grant execute on function create_job_from_quote(uuid, date, time, time) to authenticated;

create or replace function schedule_job(
  p_job_id uuid,
  p_scheduled_date date,
  p_arrival_window_start time,
  p_arrival_window_end time
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  actor_is_manager boolean;
  job_row public.jobs%rowtype;
  next_status job_status;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'dispatcher']) then
    raise exception using errcode = '42501', message = 'Not authorized to schedule jobs.';
  end if;

  actor_is_manager := public.has_any_role(array['owner', 'admin']);

  select * into job_row
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Job not found.';
  end if;

  if job_row.status in ('completed', 'cancelled') then
    return jsonb_build_object(
      'ok', false,
      'code', 'JOB_CLOSED',
      'message', format('A %s job cannot be rescheduled.', job_row.status)
    );
  end if;

  if p_scheduled_date is null or p_arrival_window_start is null or p_arrival_window_end is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'INCOMPLETE_SCHEDULE',
      'message', 'A scheduled job needs a date and both ends of its arrival window.'
    );
  end if;

  if p_arrival_window_end <= p_arrival_window_start then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_WINDOW',
      'message', 'The arrival window must end after it starts.'
    );
  end if;

  if p_scheduled_date < current_date and not actor_is_manager then
    return jsonb_build_object(
      'ok', false,
      'code', 'SCHEDULE_IN_PAST',
      'message', 'A job cannot be scheduled into the past. An owner or admin can record a historical date.'
    );
  end if;

  next_status := case
    when job_row.status = 'unscheduled' then 'scheduled'
    when job_row.status = 'confirmed'
      and (job_row.scheduled_date is distinct from p_scheduled_date
        or job_row.arrival_window_start is distinct from p_arrival_window_start
        or job_row.arrival_window_end is distinct from p_arrival_window_end)
      then 'scheduled'
    else job_row.status
  end;

  update public.jobs
  set
    scheduled_date = p_scheduled_date,
    arrival_window_start = p_arrival_window_start,
    arrival_window_end = p_arrival_window_end,
    status = next_status,
    updated_at = now()
  where id = p_job_id;

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
    'job',
    p_job_id,
    'job.scheduled',
    jsonb_build_object(
      'scheduledDate', job_row.scheduled_date,
      'arrivalWindowStart', job_row.arrival_window_start,
      'arrivalWindowEnd', job_row.arrival_window_end,
      'status', job_row.status
    ),
    jsonb_build_object(
      'scheduledDate', p_scheduled_date,
      'arrivalWindowStart', p_arrival_window_start,
      'arrivalWindowEnd', p_arrival_window_end,
      'status', next_status,
      'backdated', p_scheduled_date < current_date
    )
  );

  return jsonb_build_object('ok', true, 'status', next_status);
end;
$$;

revoke all on function schedule_job(uuid, date, time, time) from public, anon;
grant execute on function schedule_job(uuid, date, time, time) to authenticated;
