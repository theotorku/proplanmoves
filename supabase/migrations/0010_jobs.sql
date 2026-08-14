-- Quote-to-job conversion, scheduling, and the job lifecycle.
-- Rollback note: pre-launch only, drop the functions below.

-- Why a job was cancelled, or why it was completed without a recorded start.
alter table jobs
  add column if not exists decision_notes text;

create index if not exists jobs_scheduled_date_idx on jobs(scheduled_date, arrival_window_start);
create index if not exists jobs_lead_idx on jobs(lead_id);

-- Conversion snapshots the commercial and move facts. Jobs are dispatch's
-- record of what was sold, so later edits to a quote or estimate must not
-- rewrite what the crew was told.
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

  select * into quote_row
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Quote not found.';
  end if;

  -- Idempotent by design: a repeated conversion returns the job that already
  -- exists instead of creating a second one or failing the caller.
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

  -- Booking the work is what closes the lead. transition_lead_status is not
  -- open to dispatchers, and this is a consequence of the conversion rather
  -- than an independent lead decision, so the move is written here with the
  -- same activity and audit records.
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
      'estimatedRevenueCents', quote_row.total_cents
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
  job_row public.jobs%rowtype;
  next_status job_status;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'dispatcher']) then
    raise exception using errcode = '42501', message = 'Not authorized to schedule jobs.';
  end if;

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

  -- Moving the date of a job the customer already confirmed drops it back to
  -- scheduled, because the confirmation was for the old window.
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
      'status', next_status
    )
  );

  return jsonb_build_object('ok', true, 'status', next_status);
end;
$$;

revoke all on function schedule_job(uuid, date, time, time) from public, anon;
grant execute on function schedule_job(uuid, date, time, time) to authenticated;

create or replace function update_job_requirements(
  p_job_id uuid,
  p_crew_size integer,
  p_truck_count integer,
  p_estimated_duration_minutes integer,
  p_operational_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  job_row public.jobs%rowtype;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'dispatcher']) then
    raise exception using errcode = '42501', message = 'Not authorized to update jobs.';
  end if;

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
      'message', format('A %s job cannot be changed.', job_row.status)
    );
  end if;

  if p_crew_size is null or p_crew_size < 1 or p_crew_size > 12
    or p_truck_count is null or p_truck_count < 1 or p_truck_count > 6
    or p_estimated_duration_minutes is null or p_estimated_duration_minutes < 30
    or p_estimated_duration_minutes > 4320 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_REQUIREMENTS',
      'message', 'Crew, trucks, and duration must be within operating limits.'
    );
  end if;

  update public.jobs
  set
    crew_size = p_crew_size,
    truck_count = p_truck_count,
    estimated_duration_minutes = p_estimated_duration_minutes,
    operational_notes = nullif(trim(coalesce(p_operational_notes, '')), ''),
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
    'job.requirements_updated',
    jsonb_build_object(
      'crewSize', job_row.crew_size,
      'truckCount', job_row.truck_count,
      'estimatedDurationMinutes', job_row.estimated_duration_minutes
    ),
    jsonb_build_object(
      'crewSize', p_crew_size,
      'truckCount', p_truck_count,
      'estimatedDurationMinutes', p_estimated_duration_minutes
    )
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function update_job_requirements(uuid, integer, integer, integer, text)
  from public, anon;
grant execute on function update_job_requirements(uuid, integer, integer, integer, text)
  to authenticated;

create or replace function transition_job_status(
  p_job_id uuid,
  p_expected_status job_status,
  p_next_status job_status,
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
  job_row public.jobs%rowtype;
  normalized_reason text := nullif(trim(p_reason), '');
  transition_allowed boolean;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'dispatcher']) then
    raise exception using errcode = '42501', message = 'Not authorized to update jobs.';
  end if;

  actor_is_manager := public.has_any_role(array['owner', 'admin']);

  select * into job_row
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Job not found.';
  end if;

  if job_row.status <> p_expected_status then
    return jsonb_build_object(
      'ok', false,
      'code', 'STALE_STATUS',
      'message', 'The job status changed before this request completed.'
    );
  end if;

  if job_row.status = p_next_status then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  transition_allowed := case job_row.status
    when 'unscheduled' then p_next_status in ('scheduled', 'cancelled')
    when 'scheduled' then p_next_status in ('confirmed', 'in_progress', 'completed', 'unscheduled', 'cancelled')
    when 'confirmed' then p_next_status in ('in_progress', 'completed', 'scheduled', 'cancelled')
    when 'in_progress' then p_next_status in ('completed', 'cancelled')
    else false
  end;

  if not transition_allowed then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_TRANSITION',
      'message', format('Cannot move a job from %s to %s.', job_row.status, p_next_status)
    );
  end if;

  if p_next_status = 'scheduled' and job_row.scheduled_date is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'SCHEDULE_REQUIRED',
      'message', 'Give the job a date and arrival window before scheduling it.'
    );
  end if;

  -- A job that was never started but is being marked done is a records
  -- correction, so it takes an owner or admin and an explanation.
  if p_next_status = 'completed' and job_row.status <> 'in_progress' then
    if not actor_is_manager then
      return jsonb_build_object(
        'ok', false,
        'code', 'FORBIDDEN',
        'message', 'Only an owner or admin can complete a job that was never started.'
      );
    end if;

    if normalized_reason is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'REASON_REQUIRED',
        'message', 'Completing a job that was never started requires a reason.'
      );
    end if;
  end if;

  if p_next_status = 'cancelled' and normalized_reason is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'REASON_REQUIRED',
      'message', 'Cancelling a job requires a reason.'
    );
  end if;

  update public.jobs
  set
    status = p_next_status,
    -- Unscheduling clears the window so the constraint and the board agree.
    scheduled_date = case when p_next_status = 'unscheduled' then null else scheduled_date end,
    arrival_window_start = case when p_next_status = 'unscheduled' then null else arrival_window_start end,
    arrival_window_end = case when p_next_status = 'unscheduled' then null else arrival_window_end end,
    decision_notes = case
      when p_next_status in ('completed', 'cancelled') then normalized_reason
      else decision_notes
    end,
    updated_at = now()
  where id = p_job_id;

  insert into public.lead_activities (
    lead_id,
    activity_type,
    outcome,
    created_by,
    metadata
  )
  values (
    job_row.lead_id,
    'job_status_changed',
    job_row.reference || ': ' || job_row.status::text || ' -> ' || p_next_status::text,
    actor_id,
    jsonb_build_object('jobId', p_job_id, 'reason', normalized_reason)
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
    'job',
    p_job_id,
    'job.status_changed',
    jsonb_build_object('status', job_row.status),
    jsonb_build_object('status', p_next_status, 'reason', normalized_reason)
  );

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

revoke all on function transition_job_status(uuid, job_status, job_status, text)
  from public, anon;
grant execute on function transition_job_status(uuid, job_status, job_status, text)
  to authenticated;
