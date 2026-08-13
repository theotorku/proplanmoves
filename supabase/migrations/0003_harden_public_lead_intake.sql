-- Harden public lead intake.
-- Rollback note: restore submit_public_lead_request(jsonb) from 0002 if needed.

create or replace function submit_public_lead_request(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_record customers%rowtype;
  email_customer_id uuid;
  phone_customer_id uuid;
  origin_address_id uuid;
  destination_address_id uuid;
  lead_record leads%rowtype;
  email_value text := lower(nullif(trim(payload->>'email'), ''));
  phone_value text := nullif(regexp_replace(coalesce(payload->>'phone', ''), '[^0-9]', '', 'g'), '');
  origin_payload jsonb := payload->'originAddress';
  destination_payload jsonb := payload->'destinationAddress';
  deduped boolean := false;
begin
  if email_value is null and phone_value is null then
    raise exception 'Either email or phone is required.';
  end if;

  -- Serialize submissions for the same normalized identifiers so two public
  -- requests cannot both pass the lookup and race on the unique indexes.
  if email_value is not null then
    perform pg_advisory_xact_lock(hashtextextended('customer-email:' || email_value, 0));
  end if;
  if phone_value is not null then
    perform pg_advisory_xact_lock(hashtextextended('customer-phone:' || phone_value, 0));
  end if;

  select id
  into email_customer_id
  from customers
  where deleted_at is null
    and email_normalized = email_value
  for update;

  select id
  into phone_customer_id
  from customers
  where deleted_at is null
    and phone_normalized = phone_value
  for update;

  if email_customer_id is not null
    and phone_customer_id is not null
    and email_customer_id <> phone_customer_id then
    raise exception using
      errcode = '23514',
      message = 'The supplied contact identifiers belong to different customers.';
  end if;

  if coalesce(email_customer_id, phone_customer_id) is not null then
    select *
    into strict customer_record
    from customers
    where id = coalesce(email_customer_id, phone_customer_id);
    deduped := true;
  else
    insert into customers (
      first_name,
      last_name,
      email,
      phone,
      preferred_contact_method,
      marketing_consent
    )
    values (
      payload->>'firstName',
      payload->>'lastName',
      payload->>'email',
      payload->>'phone',
      (payload->>'preferredContactMethod')::contact_method,
      coalesce((payload->>'marketingConsent')::boolean, false)
    )
    returning * into customer_record;
  end if;

  insert into addresses (
    customer_id,
    line1,
    line2,
    city,
    state,
    postal_code,
    access_notes
  )
  values (
    customer_record.id,
    origin_payload->>'line1',
    origin_payload->>'line2',
    origin_payload->>'city',
    upper(origin_payload->>'state'),
    origin_payload->>'postalCode',
    origin_payload->>'accessNotes'
  )
  returning id into origin_address_id;

  insert into addresses (
    customer_id,
    line1,
    line2,
    city,
    state,
    postal_code,
    access_notes
  )
  values (
    customer_record.id,
    destination_payload->>'line1',
    destination_payload->>'line2',
    destination_payload->>'city',
    upper(destination_payload->>'state'),
    destination_payload->>'postalCode',
    destination_payload->>'accessNotes'
  )
  returning id into destination_address_id;

  insert into leads (
    customer_id,
    move_type,
    origin_address_id,
    destination_address_id,
    requested_move_date,
    flexible_move_date,
    bedroom_count,
    origin_floor,
    destination_floor,
    origin_has_elevator,
    destination_has_elevator,
    needs_packing,
    needs_storage,
    specialty_items,
    estimated_boxes,
    notes,
    lead_source
  )
  values (
    customer_record.id,
    (payload->>'moveType')::move_type,
    origin_address_id,
    destination_address_id,
    nullif(payload->>'requestedMoveDate', '')::date,
    coalesce((payload->>'flexibleMoveDate')::boolean, false),
    nullif(payload->>'bedroomCount', '')::integer,
    nullif(payload->>'originFloor', '')::integer,
    nullif(payload->>'destinationFloor', '')::integer,
    nullif(payload->>'originHasElevator', '')::boolean,
    nullif(payload->>'destinationHasElevator', '')::boolean,
    coalesce((payload->>'needsPacking')::boolean, false),
    coalesce((payload->>'needsStorage')::boolean, false),
    coalesce(payload->'specialtyItems', '[]'::jsonb),
    nullif(payload->>'estimatedBoxes', '')::integer,
    payload->>'notes',
    'website'
  )
  returning * into lead_record;

  insert into audit_events (
    actor_profile_id,
    entity_type,
    entity_id,
    event_type,
    previous_values,
    new_values
  )
  values (
    null,
    'lead',
    lead_record.id,
    'lead.created',
    null,
    jsonb_build_object(
      'reference', lead_record.reference,
      'customerId', customer_record.id,
      'customerDeduped', deduped,
      'source', 'website'
    )
  );

  return jsonb_build_object(
    'leadReference', lead_record.reference,
    'customerReference', customer_record.reference,
    'dedupedCustomer', deduped
  );
end;
$$;

revoke all on function submit_public_lead_request(jsonb) from public;
revoke all on function submit_public_lead_request(jsonb) from anon;
revoke all on function submit_public_lead_request(jsonb) from authenticated;
grant execute on function submit_public_lead_request(jsonb) to service_role;

-- Shared, atomic abuse-control state for serverless and multi-instance
-- deployments. Only the service role can access this table or function.
create table public_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public_rate_limits enable row level security;
revoke all on public_rate_limits from public, anon, authenticated;

create or replace function consume_public_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  bucket public.public_rate_limits%rowtype;
  retry_after_seconds integer;
begin
  if nullif(trim(p_bucket_key), '') is null
    or p_limit < 1
    or p_window_seconds < 1 then
    raise exception using
      errcode = '22023',
      message = 'Invalid rate-limit parameters.';
  end if;

  insert into public.public_rate_limits (
    bucket_key,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_bucket_key, v_now, 1, v_now)
  on conflict (bucket_key) do update
  set
    window_started_at = case
      when public.public_rate_limits.window_started_at
        + make_interval(secs => p_window_seconds) <= v_now
      then v_now
      else public.public_rate_limits.window_started_at
    end,
    request_count = case
      when public.public_rate_limits.window_started_at
        + make_interval(secs => p_window_seconds) <= v_now
      then 1
      else public.public_rate_limits.request_count + 1
    end,
    updated_at = v_now
  returning * into bucket;

  if bucket.request_count <= p_limit then
    return jsonb_build_object(
      'allowed', true,
      'remaining', p_limit - bucket.request_count
    );
  end if;

  retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from (
      bucket.window_started_at
        + make_interval(secs => p_window_seconds)
        - v_now
    )))::integer
  );

  return jsonb_build_object(
    'allowed', false,
    'retryAfterSeconds', retry_after_seconds
  );
end;
$$;

revoke all on function consume_public_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function consume_public_rate_limit(text, integer, integer)
  to service_role;
