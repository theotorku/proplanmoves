begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

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

select * from finish();
rollback;
