-- Public lead intake RPC for Checkpoint 2.
-- Rollback note: pre-launch only, drop function submit_public_lead_request(jsonb)
-- and revoke the grants added here.

grant usage on schema public to authenticated;
grant select on roles, profiles, profile_roles, customers, addresses, leads, pricing_rules,
  pricing_rule_versions, estimates, estimate_line_items, quotes, quote_line_items, jobs,
  audit_events to authenticated;
grant insert, update on customers, addresses, leads, estimates, estimate_line_items,
  quotes, quote_line_items, jobs, audit_events to authenticated;

create or replace function submit_public_lead_request(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_record customers%rowtype;
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

  select *
  into customer_record
  from customers
  where deleted_at is null
    and (
      (email_value is not null and email_normalized = email_value)
      or (phone_value is not null and phone_normalized = phone_value)
    )
  order by created_at asc
  limit 1;

  if found then
    deduped := true;
    update customers
    set
      first_name = payload->>'firstName',
      last_name = payload->>'lastName',
      email = coalesce(payload->>'email', email),
      phone = coalesce(payload->>'phone', phone),
      preferred_contact_method = (payload->>'preferredContactMethod')::contact_method,
      marketing_consent = coalesce((payload->>'marketingConsent')::boolean, marketing_consent),
      updated_at = now()
    where id = customer_record.id
    returning * into customer_record;
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
