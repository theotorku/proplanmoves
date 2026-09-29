begin;

create extension if not exists pgtap with schema extensions;

select plan(143);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.customers'::regclass),
  'customers has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.leads'::regclass),
  'leads has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.public_rate_limits'::regclass),
  'public rate-limit state has RLS enabled'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.submit_public_lead_request(jsonb)',
    'EXECUTE'
  ),
  'anonymous callers cannot invoke the service-role intake RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_public_rate_limit(text,integer,integer)',
    'EXECUTE'
  ),
  'authenticated callers cannot manipulate public rate limits'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.consume_public_rate_limit(text,integer,integer)',
    'EXECUTE'
  ),
  'service role can consume public rate limits'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.transition_lead_status(uuid,lead_status,lead_status,text)',
    'EXECUTE'
  ),
  'authenticated staff can invoke the protected transition RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.leads', 'UPDATE'),
  'authenticated callers cannot bypass the lead transition RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.assign_lead(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated staff can invoke the protected assignment RPC'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'admin-test@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.profiles (id, full_name)
values ('10000000-0000-4000-8000-000000000001', 'Database Test Admin');

insert into public.profile_roles (profile_id, role_id)
select '10000000-0000-4000-8000-000000000001', id
from public.roles
where code = 'admin';

insert into public.customers (
  id,
  first_name,
  last_name,
  email,
  preferred_contact_method
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'First',
    'Customer',
    'first@example.com',
    'email'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Second',
    'Customer',
    'second@example.com',
    'email'
  );

update public.customers
set phone = '3125550199'
where id = '20000000-0000-4000-8000-000000000002';

select throws_ok(
  $$
    select public.submit_public_lead_request(
      '{
        "firstName": "Conflict",
        "lastName": "Test",
        "email": "first@example.com",
        "phone": "3125550199",
        "preferredContactMethod": "email",
        "moveType": "residential",
        "originAddress": {
          "line1": "10 State St",
          "city": "Chicago",
          "state": "IL",
          "postalCode": "60601"
        },
        "destinationAddress": {
          "line1": "20 State St",
          "city": "Chicago",
          "state": "IL",
          "postalCode": "60602"
        }
      }'::jsonb
    )
  $$,
  '23514',
  'The supplied contact identifiers belong to different customers.',
  'intake rejects email and phone identifiers belonging to different customers'
);

insert into public.addresses (
  id,
  customer_id,
  line1,
  city,
  state,
  postal_code
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '100 Main St',
    'Chicago',
    'IL',
    '60601'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '200 Main St',
    'Chicago',
    'IL',
    '60602'
  );

select throws_ok(
  $$
    insert into public.leads (
      customer_id,
      move_type,
      origin_address_id
    )
    values (
      '20000000-0000-4000-8000-000000000001',
      'residential',
      '30000000-0000-4000-8000-000000000002'
    )
  $$,
  '23503',
  null,
  'a lead cannot use another customer address'
);

insert into public.leads (
  id,
  customer_id,
  move_type,
  origin_address_id
)
values (
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'residential',
  '30000000-0000-4000-8000-000000000001'
);

select throws_ok(
  $$
    insert into public.estimates (
      lead_id,
      customer_id,
      pricing_rule_version_id,
      suggested_crew_size,
      suggested_truck_count,
      estimated_minutes,
      low_total_cents,
      high_total_cents,
      confidence
    )
    select
      '40000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      id,
      2,
      1,
      180,
      10000,
      12000,
      'medium'
    from public.pricing_rule_versions
    limit 1
  $$,
  '23503',
  null,
  'an estimate cannot mix a lead and customer'
);

insert into public.estimates (
  id,
  lead_id,
  customer_id,
  pricing_rule_version_id,
  suggested_crew_size,
  suggested_truck_count,
  estimated_minutes,
  low_total_cents,
  high_total_cents,
  confidence
)
select
  '50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  id,
  2,
  1,
  180,
  10000,
  12000,
  'medium'
from public.pricing_rule_versions
limit 1;

select throws_ok(
  $$
    update public.pricing_rule_versions
    set rules_json = jsonb_set(rules_json, '{minimumBillableMinutes}', '1')
    where id = (
      select pricing_rule_version_id
      from public.estimates
      where id = '50000000-0000-4000-8000-000000000001'
    )
  $$,
  '23514',
  'Pricing rule versions used by an estimate are immutable.',
  'a used pricing version cannot be modified'
);

select is(
  (public.consume_public_rate_limit('database-test-bucket', 1, 60)->>'allowed')::boolean,
  true,
  'the first shared rate-limit request is allowed'
);
select is(
  (public.consume_public_rate_limit('database-test-bucket', 1, 60)->>'allowed')::boolean,
  false,
  'the shared rate limit blocks the next request'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    public.transition_lead_status(
      '40000000-0000-4000-8000-000000000001',
      'new',
      'qualified',
      null
    )->>'ok'
  )::boolean,
  true,
  'an authorized valid lead transition succeeds'
);
select is(
  (
    select status::text
    from public.leads
    where id = '40000000-0000-4000-8000-000000000001'
  ),
  'qualified',
  'the transition updates the lead'
);
select is(
  (
    select count(*)::integer
    from public.lead_activities
    where lead_id = '40000000-0000-4000-8000-000000000001'
      and activity_type = 'status_changed'
  ),
  1,
  'the transition writes its activity atomically'
);
select is(
  (
    select count(*)::integer
    from public.audit_events
    where entity_id = '40000000-0000-4000-8000-000000000001'
      and event_type = 'lead.status_changed'
  ),
  1,
  'the transition writes its audit event atomically'
);
select is(
  (
    public.transition_lead_status(
      '40000000-0000-4000-8000-000000000001',
      'new',
      'contacting',
      null
    )->>'code'
  ),
  'STALE_STATUS',
  'a concurrent stale transition is rejected'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-4000-8000-000000000003',
  'authenticated',
  'authenticated',
  'viewer-test@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.profiles (id, full_name)
values ('10000000-0000-4000-8000-000000000003', 'Database Test Viewer');

insert into public.profile_roles (profile_id, role_id)
select '10000000-0000-4000-8000-000000000003', id
from public.roles
where code = 'viewer';

select is(
  (
    public.assign_lead(
      '40000000-0000-4000-8000-000000000001',
      null,
      '10000000-0000-4000-8000-000000000001'
    )->>'ok'
  )::boolean,
  true,
  'an authorized assignment succeeds'
);
select is(
  (
    select assigned_profile_id
    from public.leads
    where id = '40000000-0000-4000-8000-000000000001'
  ),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'the assignment updates the lead'
);
select is(
  (
    select count(*)::integer
    from public.lead_activities
    where lead_id = '40000000-0000-4000-8000-000000000001'
      and activity_type = 'assignment_changed'
  ),
  1,
  'the assignment writes its activity atomically'
);
select is(
  (
    select count(*)::integer
    from public.audit_events
    where entity_id = '40000000-0000-4000-8000-000000000001'
      and event_type = 'lead.assignment_changed'
  ),
  1,
  'the assignment writes its audit event atomically'
);
select is(
  (
    public.assign_lead(
      '40000000-0000-4000-8000-000000000001',
      null,
      null
    )->>'code'
  ),
  'STALE_ASSIGNMENT',
  'a concurrent stale assignment is rejected'
);
select is(
  (
    public.assign_lead(
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003'
    )->>'code'
  ),
  'INVALID_ASSIGNEE',
  'a lead cannot be assigned to a role that does not own leads'
);
select is(
  (
    select count(*)::integer
    from public.list_assignable_staff()
    where staff_id = '10000000-0000-4000-8000-000000000001'
  ),
  1,
  'the assignable staff list includes operational roles'
);
select is(
  (
    select count(*)::integer
    from public.list_assignable_staff()
    where staff_id = '10000000-0000-4000-8000-000000000003'
  ),
  0,
  'the assignable staff list excludes view-only roles'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-4000-8000-000000000004',
  'authenticated',
  'authenticated',
  'estimator-test@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.profiles (id, full_name)
values ('10000000-0000-4000-8000-000000000004', 'Database Test Estimator');

insert into public.profile_roles (profile_id, role_id)
select '10000000-0000-4000-8000-000000000004', id
from public.roles
where code = 'estimator';

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);

select is(
  (
    public.assign_lead(
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000004'
    )->>'code'
  ),
  'FORBIDDEN',
  'an estimator cannot take a lead owned by another operator'
);
select is(
  (
    public.assign_lead(
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      null
    )->>'code'
  ),
  'FORBIDDEN',
  'an estimator cannot release a lead owned by another operator'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    public.assign_lead(
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      null
    )->>'ok'
  )::boolean,
  true,
  'an admin can release a lead'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);

select is(
  (
    public.assign_lead(
      '40000000-0000-4000-8000-000000000001',
      null,
      '10000000-0000-4000-8000-000000000004'
    )->>'ok'
  )::boolean,
  true,
  'an estimator can claim an unassigned lead'
);
select is(
  (
    select assigned_profile_id
    from public.leads
    where id = '40000000-0000-4000-8000-000000000001'
  ),
  '10000000-0000-4000-8000-000000000004'::uuid,
  'the claim updates the lead'
);
select is(
  (
    public.assign_lead(
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000004',
      null
    )->>'ok'
  )::boolean,
  true,
  'an estimator can release their own lead'
);
select is(
  (
    public.assign_lead(
      '40000000-0000-4000-8000-000000000001',
      null,
      '10000000-0000-4000-8000-000000000001'
    )->>'code'
  ),
  'FORBIDDEN',
  'an estimator cannot assign a lead to another operator'
);

-- Estimate generation and review run as the estimator created above, on a
-- dedicated lead so the pricing-immutability fixture above cannot interfere.
select ok(
  not has_table_privilege('authenticated', 'public.estimates', 'INSERT'),
  'authenticated callers cannot insert estimates directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_estimate_from_calculation(uuid,uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'staff cannot post their own pricing to the estimate RPC'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.create_estimate_from_calculation(uuid,uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'the application server can create estimates from a calculation'
);
select ok(
  not has_table_privilege('authenticated', 'public.quotes', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.quote_line_items', 'INSERT'),
  'authenticated callers cannot write quote records directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.jobs', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.jobs', 'INSERT'),
  'authenticated callers cannot schedule jobs directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_events', 'INSERT'),
  'authenticated callers cannot forge audit events'
);

insert into public.leads (
  id,
  customer_id,
  move_type,
  origin_address_id
)
values (
  '40000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000001',
  'residential',
  '30000000-0000-4000-8000-000000000001'
);

select public.transition_lead_status(
  '40000000-0000-4000-8000-000000000003',
  'new',
  'qualified',
  null
);

select is(
  (
    public.create_estimate_from_calculation(
      '10000000-0000-4000-8000-000000000004',
      '40000000-0000-4000-8000-000000000003',
      (select id from public.pricing_rule_versions order by version_number limit 1),
      '{
        "crewSize": 3,
        "truckCount": 1,
        "estimatedMinutes": 240,
        "travelAllowanceMinutes": 30,
        "lowTotalCents": 100000,
        "highTotalCents": 115000,
        "confidence": "high",
        "assumptions": [],
        "warnings": ["Storage requires a warehouse hold."],
        "lineItems": [
          {"code":"moving_labor","description":"Moving labor","quantity":4,"unit":"hour","unitAmountCents":21900,"totalAmountCents":87600,"category":"labor","sortOrder":0},
          {"code":"truck","description":"Truck fee","quantity":1,"unit":"truck","unitAmountCents":7500,"totalAmountCents":7500,"category":"transport","sortOrder":1},
          {"code":"travel","description":"Travel","quantity":1,"unit":"job","unitAmountCents":4900,"totalAmountCents":4900,"category":"transport","sortOrder":2}
        ]
      }'::jsonb
    )->>'ok'
  )::boolean,
  true,
  'an estimator can generate an estimate for a qualified lead'
);
select is(
  (
    select status::text
    from public.leads
    where id = '40000000-0000-4000-8000-000000000003'
  ),
  'estimate_pending',
  'generating an estimate moves the lead to estimate_pending'
);
select is(
  (
    select count(*)::integer
    from public.estimate_line_items li
    join public.estimates e on e.id = li.estimate_id
    where e.lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  3,
  'the calculation line items are persisted'
);
select is(
  (
    select sum(li.total_amount_cents)::integer
    from public.estimate_line_items li
    join public.estimates e on e.id = li.estimate_id
    where e.lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  (
    select low_total_cents
    from public.estimates
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  'the stored total is reproducible from the stored line items'
);
select is(
  (
    select count(*)::integer
    from public.audit_events
    where event_type = 'estimate.created'
      and entity_id = (
        select id from public.estimates
        where lead_id = '40000000-0000-4000-8000-000000000003'
      )
  ),
  1,
  'generating an estimate writes its audit event'
);

select is(
  (
    public.update_estimate_line_item(
      (
        select li.id
        from public.estimate_line_items li
        join public.estimates e on e.id = li.estimate_id
        where e.lead_id = '40000000-0000-4000-8000-000000000003'
          and li.code = 'truck'
      ),
      2,
      7500
    )->>'ok'
  )::boolean,
  true,
  'an estimator can override a calculated line item'
);
select is(
  (
    select low_total_cents
    from public.estimates
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  107500,
  'the estimate total is recomputed from its line items'
);
select is(
  (
    select has_manual_adjustment
    from public.estimates
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  true,
  'an override marks the estimate as no longer derived from its pricing version'
);
select is(
  (
    select high_total_cents
    from public.estimates
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  123625,
  'the uncertainty spread is preserved across an override'
);

select is(
  (
    public.review_estimate(
      (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000003'),
      'generated',
      'under_review',
      null
    )->>'ok'
  )::boolean,
  true,
  'an estimator can submit an estimate for review'
);
select is(
  (
    public.review_estimate(
      (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000003'),
      'under_review',
      'approved',
      null
    )->>'code'
  ),
  'FORBIDDEN',
  'an estimator cannot approve an estimate'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    public.review_estimate(
      (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000003'),
      'under_review',
      'approved',
      null
    )->>'ok'
  )::boolean,
  true,
  'an admin can approve an estimate under review'
);
select is(
  (
    select status::text || ':' || (reviewed_by is not null)::text
    from public.estimates
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  'approved:true',
  'approval records the reviewer'
);
select is(
  (
    public.update_estimate_line_item(
      (
        select li.id
        from public.estimate_line_items li
        join public.estimates e on e.id = li.estimate_id
        where e.lead_id = '40000000-0000-4000-8000-000000000003'
          and li.code = 'truck'
      ),
      3,
      7500
    )->>'code'
  ),
  'ESTIMATE_CLOSED',
  'an approved estimate cannot be edited'
);

insert into public.leads (
  id,
  customer_id,
  move_type,
  origin_address_id
)
values (
  '40000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001',
  'residential',
  '30000000-0000-4000-8000-000000000001'
);

select is(
  (
    public.create_estimate_from_calculation(
      '10000000-0000-4000-8000-000000000004',
      '40000000-0000-4000-8000-000000000002',
      (select id from public.pricing_rule_versions order by version_number limit 1),
      '{
        "crewSize": 2,
        "truckCount": 1,
        "estimatedMinutes": 180,
        "lowTotalCents": 50000,
        "highTotalCents": 60000,
        "confidence": "medium",
        "lineItems": [
          {"code":"moving_labor","description":"Moving labor","quantity":3,"unit":"hour","unitAmountCents":15900,"totalAmountCents":47700,"category":"labor","sortOrder":0}
        ]
      }'::jsonb
    )->>'code'
  ),
  'INVALID_LEAD_STATUS',
  'an unqualified lead cannot be estimated'
);

select public.transition_lead_status(
  '40000000-0000-4000-8000-000000000002',
  'new',
  'qualified',
  null
);

select is(
  (
    public.create_estimate_from_calculation(
      '10000000-0000-4000-8000-000000000004',
      '40000000-0000-4000-8000-000000000002',
      (select id from public.pricing_rule_versions order by version_number limit 1),
      '{
        "crewSize": 2,
        "truckCount": 1,
        "estimatedMinutes": 180,
        "lowTotalCents": 50000,
        "highTotalCents": 60000,
        "confidence": "medium",
        "lineItems": [
          {"code":"moving_labor","description":"Moving labor","quantity":3,"unit":"hour","unitAmountCents":15900,"totalAmountCents":47700,"category":"labor","sortOrder":0}
        ]
      }'::jsonb
    )->>'code'
  ),
  'TOTAL_MISMATCH',
  'an estimate whose line items do not add up is rejected'
);
select is(
  (
    public.create_estimate_from_calculation(
      '10000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000002',
      (select id from public.pricing_rule_versions order by version_number limit 1),
      '{
        "crewSize": 2,
        "truckCount": 1,
        "estimatedMinutes": 180,
        "lowTotalCents": 47700,
        "highTotalCents": 60000,
        "confidence": "medium",
        "lineItems": [
          {"code":"moving_labor","description":"Moving labor","quantity":3,"unit":"hour","unitAmountCents":15900,"totalAmountCents":47700,"category":"labor","sortOrder":0}
        ]
      }'::jsonb
    )->>'code'
  ),
  'FORBIDDEN',
  'a view-only profile cannot be recorded as the author of an estimate'
);

select is(
  (
    select count(*)::integer
    from public.estimates
    where lead_id = '40000000-0000-4000-8000-000000000002'
  ),
  0,
  'a rejected calculation writes no estimate'
);
select is(
  (
    select status::text
    from public.leads
    where id = '40000000-0000-4000-8000-000000000002'
  ),
  'qualified',
  'a rejected calculation leaves the lead status alone'
);

-- Quote conversion and lifecycle, running as the admin from here.
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_quote_from_estimate(uuid,date,text)',
    'EXECUTE'
  ),
  'staff can convert an approved estimate into a quote'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.recalculate_quote_totals(uuid)',
    'EXECUTE'
  ),
  'quote totals cannot be recomputed outside the quote functions'
);

select is(
  (
    public.create_quote_from_estimate(
      (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000003'),
      null,
      'terms-v1'
    )->>'ok'
  )::boolean,
  true,
  'an approved estimate converts to a quote'
);
select is(
  (
    select count(*)::integer
    from public.quote_line_items qli
    join public.quotes q on q.id = qli.quote_id
    where q.lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  3,
  'the estimate line items are copied onto the quote'
);
select is(
  (
    select subtotal_cents
    from public.quotes
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  107500,
  'the quote subtotal is derived from the copied line items'
);
select is(
  (
    select status::text
    from public.leads
    where id = '40000000-0000-4000-8000-000000000003'
  ),
  'quote_pending',
  'creating a quote moves the lead to quote_pending'
);
select is(
  (
    public.create_quote_from_estimate(
      (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000003'),
      null,
      'terms-v1'
    )->>'code'
  ),
  'QUOTE_EXISTS',
  'an estimate cannot have two live quotes'
);

select public.create_estimate_from_calculation(
  '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  (select id from public.pricing_rule_versions order by version_number limit 1),
  '{
    "crewSize": 2,
    "truckCount": 1,
    "estimatedMinutes": 180,
    "lowTotalCents": 47700,
    "highTotalCents": 60000,
    "confidence": "medium",
    "lineItems": [
      {"code":"moving_labor","description":"Moving labor","quantity":3,"unit":"hour","unitAmountCents":15900,"totalAmountCents":47700,"category":"labor","sortOrder":0}
    ]
  }'::jsonb
);

select is(
  (
    public.create_quote_from_estimate(
      (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000002'),
      null,
      'terms-v1'
    )->>'code'
  ),
  'ESTIMATE_NOT_APPROVED',
  'an unapproved estimate cannot become a quote'
);

select is(
  (
    public.update_quote_line_item(
      (
        select qli.id
        from public.quote_line_items qli
        join public.quotes q on q.id = qli.quote_id
        where q.lead_id = '40000000-0000-4000-8000-000000000003'
          and qli.code = 'truck'
      ),
      1,
      7500
    )->'totals'->>'subtotalCents'
  )::integer,
  100000,
  'editing a quote line recomputes the quote subtotal'
);
select is(
  (
    public.update_quote_terms(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      200000,
      0,
      0,
      null,
      null
    )->>'code'
  ),
  'DISCOUNT_TOO_LARGE',
  'a discount cannot exceed the subtotal'
);
select is(
  (
    public.update_quote_terms(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      0,
      0,
      200000,
      null,
      null
    )->>'code'
  ),
  'DEPOSIT_TOO_LARGE',
  'a deposit cannot exceed the total'
);
select is(
  (
    public.update_quote_terms(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      5000,
      2500,
      10000,
      (current_date + 14),
      'Crew arrives between 8 and 10am.'
    )->>'totalCents'
  )::integer,
  97500,
  'quote terms recompute the total as subtotal minus discount plus tax'
);

select is(
  (
    public.transition_quote_status(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      'draft',
      'sent',
      null
    )->>'code'
  ),
  'INVALID_TRANSITION',
  'only a ready quote can be sent'
);
select is(
  (
    public.transition_quote_status(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      'draft',
      'ready',
      null
    )->>'ok'
  )::boolean,
  true,
  'a draft quote can be marked ready'
);
select is(
  (
    public.transition_quote_status(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      'ready',
      'sent',
      null
    )->>'ok'
  )::boolean,
  true,
  'a ready quote can be sent'
);
select isnt(
  (
    select sent_at
    from public.quotes
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  null,
  'sending a quote records when it went out'
);
select is(
  (
    public.update_quote_line_item(
      (
        select qli.id
        from public.quote_line_items qli
        join public.quotes q on q.id = qli.quote_id
        where q.lead_id = '40000000-0000-4000-8000-000000000003'
          and qli.code = 'truck'
      ),
      5,
      7500
    )->>'code'
  ),
  'QUOTE_LOCKED',
  'a sent quote cannot be edited underneath the customer'
);
select is(
  (
    public.transition_quote_status(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      'sent',
      'expired',
      null
    )->>'code'
  ),
  'NOT_EXPIRED',
  'a quote cannot be expired before its date'
);
select is(
  (
    public.transition_quote_status(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      'sent',
      'rejected',
      null
    )->>'code'
  ),
  'REASON_REQUIRED',
  'recording a rejection requires a reason'
);
select is(
  (
    public.transition_quote_status(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      'sent',
      'accepted',
      null
    )->>'ok'
  )::boolean,
  true,
  'a sent quote can be accepted'
);
select isnt(
  (
    select accepted_at
    from public.quotes
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  null,
  'acceptance is timestamped'
);
select is(
  (
    select status::text
    from public.leads
    where id = '40000000-0000-4000-8000-000000000003'
  ),
  'quote_pending',
  'acceptance leaves the lead for the job conversion to close'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);

select is(
  (
    public.transition_quote_status(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      'accepted',
      'cancelled',
      'Customer changed their mind'
    )->>'code'
  ),
  'FORBIDDEN',
  'an estimator cannot cancel an accepted quote'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    public.transition_quote_status(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      'accepted',
      'cancelled',
      null
    )->>'code'
  ),
  'REASON_REQUIRED',
  'cancelling an accepted quote requires a reason'
);
select is(
  (
    public.transition_quote_status(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003'),
      'accepted',
      'cancelled',
      'Customer moved out of the service area'
    )->>'ok'
  )::boolean,
  true,
  'an admin can cancel an accepted quote with a reason'
);
select is(
  (
    select decision_notes
    from public.quotes
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  'Customer moved out of the service area',
  'the cancellation reason is recorded on the quote'
);

-- Quote-to-job conversion. The cancelled quote above frees the estimate, so
-- re-quoting is the natural way into the job tests.
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-4000-8000-000000000005',
  'authenticated',
  'authenticated',
  'dispatcher-test@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.profiles (id, full_name)
values ('10000000-0000-4000-8000-000000000005', 'Database Test Dispatcher');

insert into public.profile_roles (profile_id, role_id)
select '10000000-0000-4000-8000-000000000005', id
from public.roles
where code = 'dispatcher';

select is(
  (
    public.create_quote_from_estimate(
      (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000003'),
      null,
      'terms-v1'
    )->>'ok'
  )::boolean,
  true,
  'a cancelled quote frees the estimate to be re-quoted'
);
select is(
  (
    public.create_job_from_quote(
      (
        select id from public.quotes
        where lead_id = '40000000-0000-4000-8000-000000000003'
        order by reference desc limit 1
      ),
      null,
      null,
      null
    )->>'code'
  ),
  'QUOTE_NOT_ACCEPTED',
  'only an accepted quote can become a job'
);

select public.transition_quote_status(
  (
    select id from public.quotes
    where lead_id = '40000000-0000-4000-8000-000000000003'
    order by reference desc limit 1
  ),
  'draft',
  'ready',
  null
);
select public.transition_quote_status(
  (
    select id from public.quotes
    where lead_id = '40000000-0000-4000-8000-000000000003'
    order by reference desc limit 1
  ),
  'ready',
  'sent',
  null
);
select is(
  (
    public.transition_quote_status(
      (
        select id from public.quotes
        where lead_id = '40000000-0000-4000-8000-000000000003'
        order by reference desc limit 1
      ),
      'sent',
      'accepted',
      null
    )->>'ok'
  )::boolean,
  true,
  'the replacement quote is accepted'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_job_from_quote(uuid,date,time,time)',
    'EXECUTE'
  ),
  'dispatch staff can convert an accepted quote into a job'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);

select throws_ok(
  $$
    select public.create_job_from_quote(
      (
        select id from public.quotes
        where lead_id = '40000000-0000-4000-8000-000000000003'
        order by reference desc limit 1
      ),
      null,
      null,
      null
    )
  $$,
  '42501',
  'Not authorized to create jobs.',
  'an estimator cannot book jobs'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    public.create_job_from_quote(
      (
        select id from public.quotes
        where lead_id = '40000000-0000-4000-8000-000000000003'
        order by reference desc limit 1
      ),
      null,
      null,
      null
    )->>'created'
  )::boolean,
  true,
  'an accepted quote converts to a job'
);
select is(
  (
    select status::text
    from public.jobs
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  'unscheduled',
  'a job with no date starts unscheduled'
);
select is(
  (
    select status::text
    from public.leads
    where id = '40000000-0000-4000-8000-000000000003'
  ),
  'won',
  'booking the job closes the lead as won'
);
select is(
  (
    public.create_job_from_quote(
      (
        select id from public.quotes
        where lead_id = '40000000-0000-4000-8000-000000000003'
        order by reference desc limit 1
      ),
      null,
      null,
      null
    )->>'created'
  )::boolean,
  false,
  'converting the same quote twice returns the existing job'
);
select is(
  (
    select count(*)::integer
    from public.jobs
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  1,
  'a repeated conversion creates no second job'
);
select is(
  (
    select estimated_revenue_cents
    from public.jobs
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  107500,
  'the job snapshots the quoted value'
);
select is(
  (
    select crew_size
    from public.jobs
    where lead_id = '40000000-0000-4000-8000-000000000003'
  ),
  3,
  'the job snapshots the crew the estimate recommended'
);

select is(
  (
    public.transition_job_status(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      'unscheduled',
      'scheduled',
      null
    )->>'code'
  ),
  'SCHEDULE_REQUIRED',
  'a job cannot be scheduled without a date'
);
select is(
  (
    public.schedule_job(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      (current_date + 7),
      '10:00',
      '09:00'
    )->>'code'
  ),
  'INVALID_WINDOW',
  'an arrival window must end after it starts'
);
select is(
  (
    public.schedule_job(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      (current_date + 7),
      '08:00',
      '10:00'
    )->>'status'
  ),
  'scheduled',
  'scheduling an unscheduled job puts it on the calendar'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000005',
  true
);

select is(
  (
    public.transition_job_status(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      'scheduled',
      'completed',
      'Crew finished but never started it in the app'
    )->>'code'
  ),
  'FORBIDDEN',
  'a dispatcher cannot complete a job that was never started'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    public.transition_job_status(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      'scheduled',
      'completed',
      null
    )->>'code'
  ),
  'REASON_REQUIRED',
  'completing a job that never started requires a reason'
);
select is(
  (
    public.transition_job_status(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      'scheduled',
      'confirmed',
      null
    )->>'ok'
  )::boolean,
  true,
  'a scheduled job can be confirmed'
);
select is(
  (
    public.schedule_job(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      (current_date + 9),
      '08:00',
      '10:00'
    )->>'status'
  ),
  'scheduled',
  'moving a confirmed job returns it to scheduled for reconfirmation'
);
select is(
  (
    public.transition_job_status(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      'scheduled',
      'in_progress',
      null
    )->>'ok'
  )::boolean,
  true,
  'a scheduled job can be started'
);
select is(
  (
    public.transition_job_status(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      'in_progress',
      'completed',
      null
    )->>'ok'
  )::boolean,
  true,
  'a started job completes without ceremony'
);
select is(
  (
    public.transition_job_status(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      'completed',
      'cancelled',
      'Changed our mind'
    )->>'code'
  ),
  'INVALID_TRANSITION',
  'a completed job is final'
);
select is(
  (
    public.schedule_job(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      (current_date + 14),
      '08:00',
      '10:00'
    )->>'code'
  ),
  'JOB_CLOSED',
  'a completed job cannot be rescheduled'
);
select is(
  (
    public.transition_quote_status(
      (
        select id from public.quotes
        where lead_id = '40000000-0000-4000-8000-000000000003'
        order by reference desc limit 1
      ),
      'accepted',
      'cancelled',
      'Customer changed their mind'
    )->>'code'
  ),
  'JOB_EXISTS',
  'a quote cannot be cancelled while its job is still live'
);

-- The other half of that rule, plus the past-date guard, on a second chain:
-- approve the remaining estimate, quote it, book it, then unwind it in order.
select public.review_estimate(
  (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000002'),
  'generated',
  'under_review',
  null
);
select public.review_estimate(
  (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000002'),
  'under_review',
  'approved',
  null
);
select public.create_quote_from_estimate(
  (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000002'),
  null,
  'terms-v1'
);
select public.transition_quote_status(
  (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000002'),
  'draft',
  'ready',
  null
);
select public.transition_quote_status(
  (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000002'),
  'ready',
  'sent',
  null
);
select public.transition_quote_status(
  (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000002'),
  'sent',
  'accepted',
  null
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000005',
  true
);

select is(
  (
    public.create_job_from_quote(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000002'),
      (current_date - 1),
      '08:00',
      '10:00'
    )->>'code'
  ),
  'SCHEDULE_IN_PAST',
  'a dispatcher cannot book a job into the past'
);
select is(
  (
    select count(*)::integer
    from public.jobs
    where lead_id = '40000000-0000-4000-8000-000000000002'
  ),
  0,
  'a refused past-dated booking creates no job'
);
select is(
  (
    public.create_job_from_quote(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000002'),
      null,
      null,
      null
    )->>'created'
  )::boolean,
  true,
  'the same quote books once the date is left open'
);
select is(
  (
    public.schedule_job(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000002'),
      (current_date - 1),
      '08:00',
      '10:00'
    )->>'code'
  ),
  'SCHEDULE_IN_PAST',
  'a dispatcher cannot reschedule a job into the past'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    public.schedule_job(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000002'),
      (current_date - 1),
      '08:00',
      '10:00'
    )->>'status'
  ),
  'scheduled',
  'an admin can record a historical job date'
);
select is(
  (
    public.transition_job_status(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000002'),
      'scheduled',
      'cancelled',
      'Customer cancelled the move'
    )->>'ok'
  )::boolean,
  true,
  'the job can be cancelled first'
);
select is(
  (
    public.transition_quote_status(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000002'),
      'accepted',
      'cancelled',
      'Customer cancelled the move'
    )->>'ok'
  )::boolean,
  true,
  'the quote can be cancelled once its job is cancelled'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-4000-8000-000000000002',
  'authenticated',
  'authenticated',
  'owner-test@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

-- Exercise first-owner bootstrap independently of owners created by local E2E
-- runs. These fixture changes are inside this file's BEGIN/ROLLBACK transaction:
-- existing grants are restored when the suite finishes (or the connection ends).
delete from public.profile_roles
where role_id in (select id from public.roles where code = 'owner');

select is(
  (
    public.bootstrap_initial_owner(
      '10000000-0000-4000-8000-000000000002',
      'owner-test@example.com',
      'Database Test Owner'
    )->>'ok'
  )::boolean,
  true,
  'the initial owner bootstrap succeeds atomically'
);
select is(
  (
    select count(*)::integer
    from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where r.code = 'owner'
  ),
  1,
  'owner bootstrap creates exactly one owner'
);
select is(
  (
    public.bootstrap_initial_owner(
      '10000000-0000-4000-8000-000000000001',
      'admin-test@example.com',
      'Second Owner'
    )->>'code'
  ),
  'CONFLICT',
  'a second owner bootstrap is rejected'
);

-- Row-level security, checked as the `authenticated` role rather than as the
-- superuser the rest of this file runs as. Under postgres, RLS is bypassed and
-- these reads would all succeed regardless of policy.
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-4000-8000-000000000006',
  'authenticated',
  'authenticated',
  'stranger-test@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.profiles (id, full_name)
values ('10000000-0000-4000-8000-000000000006', 'Signed In Stranger');

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000006',
  true
);
set local role authenticated;

select is(
  (select count(*)::integer from public.leads),
  0,
  'a signed-in user with no staff role sees no leads'
);
select is(
  (select count(*)::integer from public.customers),
  0,
  'a signed-in user with no staff role sees no customers'
);
select is(
  (select count(*)::integer from public.quotes),
  0,
  'a signed-in user with no staff role sees no quotes'
);
select is(
  (select count(*)::integer from public.jobs),
  0,
  'a signed-in user with no staff role sees no jobs'
);
select is(
  (select count(*)::integer from public.estimates),
  0,
  'a signed-in user with no staff role sees no estimates'
);
select throws_ok(
  $$
    insert into public.leads (customer_id, move_type)
    values ('20000000-0000-4000-8000-000000000001', 'residential')
  $$,
  '42501',
  null,
  'a signed-in user with no staff role cannot insert a lead'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;

select ok(
  (select count(*) from public.leads) > 0,
  'a viewer can read the lead queue'
);
select is(
  (select count(*)::integer from public.audit_events),
  0,
  'a viewer cannot read the audit trail'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);
set local role authenticated;

select is(
  (select count(*)::integer from public.jobs),
  0,
  'an estimator cannot read dispatch jobs'
);

reset role;

-- Negative authorization: every protected mutation refuses a read-only role.
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  true
);

select throws_ok(
  $$ select public.transition_lead_status('40000000-0000-4000-8000-000000000003', 'won', 'contacting', null) $$,
  '42501',
  'Not authorized to update leads.',
  'a viewer cannot change a lead status'
);
select throws_ok(
  $$ select public.add_lead_note_with_activity('40000000-0000-4000-8000-000000000003', 'Viewer note') $$,
  '42501',
  'Not authorized to add lead notes.',
  'a viewer cannot add a lead note'
);
select throws_ok(
  $$ select public.assign_lead('40000000-0000-4000-8000-000000000003', null, '10000000-0000-4000-8000-000000000003') $$,
  '42501',
  'Not authorized to assign leads.',
  'a viewer cannot assign a lead'
);
select throws_ok(
  $$
    select public.review_estimate(
      (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000003'),
      'approved',
      'rejected',
      'no'
    )
  $$,
  '42501',
  'Not authorized to review estimates.',
  'a viewer cannot review an estimate'
);
select throws_ok(
  $$
    select public.update_estimate_line_item(
      (
        select li.id from public.estimate_line_items li
        join public.estimates e on e.id = li.estimate_id
        where e.lead_id = '40000000-0000-4000-8000-000000000003'
        limit 1
      ),
      1,
      100
    )
  $$,
  '42501',
  'Not authorized to edit estimates.',
  'a viewer cannot edit estimate amounts'
);
select throws_ok(
  $$
    select public.create_quote_from_estimate(
      (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000003'),
      null,
      'terms-v1'
    )
  $$,
  '42501',
  'Not authorized to create quotes.',
  'a viewer cannot create a quote'
);
select throws_ok(
  $$
    select public.transition_quote_status(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003' order by reference desc limit 1),
      'accepted',
      'cancelled',
      'no'
    )
  $$,
  '42501',
  'Not authorized to update quotes.',
  'a viewer cannot change a quote status'
);
select throws_ok(
  $$
    select public.update_quote_terms(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003' order by reference desc limit 1),
      0, 0, 0, null, null
    )
  $$,
  '42501',
  'Not authorized to edit quotes.',
  'a viewer cannot change quote terms'
);
select throws_ok(
  $$
    select public.create_job_from_quote(
      (select id from public.quotes where lead_id = '40000000-0000-4000-8000-000000000003' order by reference desc limit 1),
      null, null, null
    )
  $$,
  '42501',
  'Not authorized to create jobs.',
  'a viewer cannot book a job'
);
select throws_ok(
  $$
    select public.schedule_job(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      current_date + 1, '08:00', '10:00'
    )
  $$,
  '42501',
  'Not authorized to schedule jobs.',
  'a viewer cannot schedule a job'
);
select throws_ok(
  $$
    select public.transition_job_status(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      'completed',
      'cancelled',
      'no'
    )
  $$,
  '42501',
  'Not authorized to update jobs.',
  'a viewer cannot change a job status'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000005',
  true
);

select throws_ok(
  $$
    select public.create_quote_from_estimate(
      (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000003'),
      null,
      'terms-v1'
    )
  $$,
  '42501',
  'Not authorized to create quotes.',
  'a dispatcher cannot create a quote'
);
select throws_ok(
  $$
    select public.review_estimate(
      (select id from public.estimates where lead_id = '40000000-0000-4000-8000-000000000003'),
      'approved',
      'rejected',
      'no'
    )
  $$,
  '42501',
  'Not authorized to review estimates.',
  'a dispatcher cannot review an estimate'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);

select throws_ok(
  $$
    select public.schedule_job(
      (select id from public.jobs where lead_id = '40000000-0000-4000-8000-000000000003'),
      current_date + 1, '08:00', '10:00'
    )
  $$,
  '42501',
  'Not authorized to schedule jobs.',
  'an estimator cannot schedule a job'
);

select * from finish();
rollback;
