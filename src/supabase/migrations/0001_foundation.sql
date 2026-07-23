-- Foundation schema for ProPlan Moves OS.
-- Rollback note: pre-launch only, drop dependent policies/functions before tables.

create extension if not exists pgcrypto;

create type contact_method as enum ('email', 'phone', 'sms');
create type lead_status as enum ('new', 'contacting', 'qualified', 'estimate_pending', 'quote_pending', 'won', 'unresponsive', 'disqualified', 'lost');
create type move_type as enum ('residential', 'apartment', 'office', 'labor_only', 'packing_service');
create type estimate_status as enum ('draft', 'generated', 'under_review', 'approved', 'rejected');
create type quote_status as enum ('draft', 'ready', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled');
create type job_status as enum ('unscheduled', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled');

create table roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('owner', 'admin', 'estimator', 'dispatcher', 'viewer')),
  name text not null
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profile_roles (
  profile_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (profile_id, role_id)
);

create table reference_counters (
  entity_type text not null,
  reference_year integer not null,
  last_value integer not null default 0,
  primary key (entity_type, reference_year)
);

create or replace function next_reference(entity_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year integer := extract(year from now() at time zone 'utc')::integer;
  next_value integer;
  prefix text;
begin
  if entity_type = 'lead' then
    prefix := 'LEAD';
  elsif entity_type = 'estimate' then
    prefix := 'EST';
  elsif entity_type = 'quote' then
    prefix := 'QUO';
  elsif entity_type = 'job' then
    prefix := 'JOB';
  else
    raise exception 'Unsupported entity type: %', entity_type;
  end if;

  insert into reference_counters(entity_type, reference_year, last_value)
  values (entity_type, current_year, 1)
  on conflict (entity_type, reference_year)
  do update set last_value = reference_counters.last_value + 1
  returning last_value into next_value;

  return prefix || '-' || current_year || '-' || lpad(next_value::text, 5, '0');
end;
$$;

create table customers (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('CUST-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  first_name text not null,
  last_name text not null,
  email text,
  email_normalized text generated always as (lower(nullif(trim(email), ''))) stored,
  phone text,
  phone_normalized text generated always as (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored,
  preferred_contact_method contact_method not null default 'email',
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint customer_contact_required check (email_normalized is not null or nullif(phone_normalized, '') is not null)
);

create unique index customers_email_unique_idx on customers(email_normalized) where email_normalized is not null and deleted_at is null;
create unique index customers_phone_unique_idx on customers(phone_normalized) where nullif(phone_normalized, '') is not null and deleted_at is null;

create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null check (char_length(state) = 2),
  postal_code text not null,
  access_notes text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default next_reference('lead'),
  customer_id uuid not null references customers(id) on delete restrict,
  status lead_status not null default 'new',
  move_type move_type not null,
  origin_address_id uuid references addresses(id) on delete restrict,
  destination_address_id uuid references addresses(id) on delete restrict,
  requested_move_date date,
  flexible_move_date boolean not null default false,
  bedroom_count integer check (bedroom_count between 0 and 10),
  origin_floor integer check (origin_floor >= 0),
  destination_floor integer check (destination_floor >= 0),
  origin_has_elevator boolean,
  destination_has_elevator boolean,
  needs_packing boolean not null default false,
  needs_storage boolean not null default false,
  specialty_items jsonb not null default '[]'::jsonb,
  estimated_boxes integer check (estimated_boxes >= 0),
  notes text,
  lead_source text not null default 'website',
  assigned_profile_id uuid references profiles(id) on delete set null,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terminal_reason_required check (status not in ('disqualified', 'lost') or lost_reason is not null)
);

create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pricing_rule_versions (
  id uuid primary key default gen_random_uuid(),
  pricing_rule_id uuid not null references pricing_rules(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  rules_json jsonb not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (pricing_rule_id, version_number),
  constraint pricing_rule_version_dates check (effective_to is null or effective_to > effective_from)
);

create table estimates (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default next_reference('estimate'),
  lead_id uuid not null references leads(id) on delete restrict,
  customer_id uuid not null references customers(id) on delete restrict,
  pricing_rule_version_id uuid not null references pricing_rule_versions(id) on delete restrict,
  status estimate_status not null default 'draft',
  suggested_crew_size integer not null check (suggested_crew_size > 0),
  suggested_truck_count integer not null check (suggested_truck_count > 0),
  estimated_minutes integer not null check (estimated_minutes > 0),
  travel_allowance_minutes integer not null default 0 check (travel_allowance_minutes >= 0),
  low_total_cents integer not null check (low_total_cents >= 0),
  high_total_cents integer not null check (high_total_cents >= low_total_cents),
  currency char(3) not null default 'USD',
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  assumptions jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  code text not null,
  description text not null,
  quantity numeric(10, 2) not null check (quantity >= 0),
  unit text not null,
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  total_amount_cents integer not null check (total_amount_cents >= 0),
  category text not null,
  sort_order integer not null default 0
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default next_reference('quote'),
  estimate_id uuid not null references estimates(id) on delete restrict,
  lead_id uuid not null references leads(id) on delete restrict,
  customer_id uuid not null references customers(id) on delete restrict,
  status quote_status not null default 'draft',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  currency char(3) not null default 'USD',
  expires_on date,
  terms_version text not null,
  customer_notes text,
  internal_notes text,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_total_matches check (total_cents = subtotal_cents - discount_cents + tax_cents),
  constraint quote_deposit_within_total check (deposit_cents <= total_cents)
);

create table quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  source_estimate_line_item_id uuid references estimate_line_items(id) on delete set null,
  code text not null,
  description text not null,
  quantity numeric(10, 2) not null check (quantity >= 0),
  unit text not null,
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  total_amount_cents integer not null check (total_amount_cents >= 0),
  category text not null,
  sort_order integer not null default 0
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default next_reference('job'),
  customer_id uuid not null references customers(id) on delete restrict,
  lead_id uuid not null references leads(id) on delete restrict,
  estimate_id uuid not null references estimates(id) on delete restrict,
  quote_id uuid not null unique references quotes(id) on delete restrict,
  status job_status not null default 'unscheduled',
  scheduled_date date,
  arrival_window_start time,
  arrival_window_end time,
  origin_address_id uuid references addresses(id) on delete restrict,
  destination_address_id uuid references addresses(id) on delete restrict,
  crew_size integer not null check (crew_size > 0),
  truck_count integer not null check (truck_count > 0),
  estimated_duration_minutes integer not null check (estimated_duration_minutes > 0),
  estimated_revenue_cents integer not null check (estimated_revenue_cents >= 0),
  operational_notes text,
  customer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_window_required check (status <> 'scheduled' or (scheduled_date is not null and arrival_window_start is not null and arrival_window_end is not null)),
  constraint scheduled_window_order check (arrival_window_end is null or arrival_window_start is null or arrival_window_end > arrival_window_start)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  previous_values jsonb,
  new_values jsonb,
  request_correlation_id uuid,
  occurred_at timestamptz not null default now()
);

create index leads_status_created_idx on leads(status, created_at desc);
create index leads_move_date_idx on leads(requested_move_date);
create index leads_source_idx on leads(lead_source);
create index leads_assigned_profile_idx on leads(assigned_profile_id);
create index quotes_status_expiration_idx on quotes(status, expires_on);
create index quotes_accepted_at_idx on quotes(accepted_at);
create index jobs_status_scheduled_idx on jobs(status, scheduled_date);
create index audit_entity_idx on audit_events(entity_type, entity_id, occurred_at desc);

create or replace function has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profile_roles pr
    join roles r on r.id = pr.role_id
    join profiles p on p.id = pr.profile_id
    where pr.profile_id = auth.uid()
      and p.is_active
      and r.code = required_role
  );
$$;

create or replace function has_any_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profile_roles pr
    join roles r on r.id = pr.role_id
    join profiles p on p.id = pr.profile_id
    where pr.profile_id = auth.uid()
      and p.is_active
      and r.code = any(required_roles)
  );
$$;

alter table roles enable row level security;
alter table profiles enable row level security;
alter table profile_roles enable row level security;
alter table reference_counters enable row level security;
alter table customers enable row level security;
alter table addresses enable row level security;
alter table leads enable row level security;
alter table pricing_rules enable row level security;
alter table pricing_rule_versions enable row level security;
alter table estimates enable row level security;
alter table estimate_line_items enable row level security;
alter table quotes enable row level security;
alter table quote_line_items enable row level security;
alter table jobs enable row level security;
alter table audit_events enable row level security;

create policy roles_staff_read on roles for select to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']));
create policy profiles_self_read on profiles for select to authenticated using (id = auth.uid() or has_any_role(array['owner', 'admin']));
create policy profile_roles_self_read on profile_roles for select to authenticated using (profile_id = auth.uid() or has_any_role(array['owner', 'admin']));

create policy operational_read on customers for select to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']));
create policy operational_read on addresses for select to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']));
create policy operational_read on leads for select to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']));
create policy operational_read on pricing_rules for select to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']));
create policy operational_read on pricing_rule_versions for select to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']));
create policy operational_read on estimates for select to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'viewer']));
create policy operational_read on estimate_line_items for select to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'viewer']));
create policy operational_read on quotes for select to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']));
create policy operational_read on quote_line_items for select to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']));
create policy operational_read on jobs for select to authenticated using (has_any_role(array['owner', 'admin', 'dispatcher', 'viewer']));
create policy audit_read on audit_events for select to authenticated using (has_any_role(array['owner', 'admin']));

create policy customer_staff_write on customers for all to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher'])) with check (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher']));
create policy address_staff_write on addresses for all to authenticated using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher'])) with check (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher']));
create policy lead_staff_write on leads for all to authenticated using (has_any_role(array['owner', 'admin', 'estimator'])) with check (has_any_role(array['owner', 'admin', 'estimator']));
create policy pricing_admin_write on pricing_rules for all to authenticated using (has_any_role(array['owner', 'admin'])) with check (has_any_role(array['owner', 'admin']));
create policy pricing_version_admin_write on pricing_rule_versions for all to authenticated using (has_any_role(array['owner', 'admin'])) with check (has_any_role(array['owner', 'admin']));
create policy estimate_staff_write on estimates for all to authenticated using (has_any_role(array['owner', 'admin', 'estimator'])) with check (has_any_role(array['owner', 'admin', 'estimator']));
create policy estimate_line_staff_write on estimate_line_items for all to authenticated using (has_any_role(array['owner', 'admin', 'estimator'])) with check (has_any_role(array['owner', 'admin', 'estimator']));
create policy quote_staff_write on quotes for all to authenticated using (has_any_role(array['owner', 'admin', 'estimator'])) with check (has_any_role(array['owner', 'admin', 'estimator']));
create policy quote_line_staff_write on quote_line_items for all to authenticated using (has_any_role(array['owner', 'admin', 'estimator'])) with check (has_any_role(array['owner', 'admin', 'estimator']));
create policy job_dispatch_write on jobs for all to authenticated using (has_any_role(array['owner', 'admin', 'dispatcher'])) with check (has_any_role(array['owner', 'admin', 'dispatcher']));
create policy audit_server_insert on audit_events for insert to authenticated with check (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher']));

revoke all on reference_counters from anon, authenticated;
