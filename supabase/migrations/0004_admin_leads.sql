-- Admin lead operations: notes and activities.
-- Rollback note: pre-launch only, drop lead_notes and lead_activities.

create table if not exists lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  activity_type text not null,
  outcome text,
  occurred_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists lead_notes_lead_created_idx on lead_notes(lead_id, created_at desc);
create index if not exists lead_activities_lead_occurred_idx on lead_activities(lead_id, occurred_at desc);

alter table lead_notes enable row level security;
alter table lead_activities enable row level security;

grant select, insert, update on lead_notes, lead_activities to authenticated;

create policy lead_notes_staff_read on lead_notes
  for select to authenticated
  using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']));

create policy lead_notes_staff_insert on lead_notes
  for insert to authenticated
  with check (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher']));

create policy lead_notes_author_update on lead_notes
  for update to authenticated
  using (author_id = auth.uid() or has_any_role(array['owner', 'admin']))
  with check (author_id = auth.uid() or has_any_role(array['owner', 'admin']));

create policy lead_activities_staff_read on lead_activities
  for select to authenticated
  using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']));

create policy lead_activities_staff_insert on lead_activities
  for insert to authenticated
  with check (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher']));

-- Protected lifecycle mutations are transactional database operations. Direct
-- lead updates are removed so callers cannot bypass transition validation or
-- omit the activity/audit records.
revoke update on leads from authenticated;
revoke insert on lead_notes, lead_activities from authenticated;

create or replace function transition_lead_status(
  p_lead_id uuid,
  p_expected_status lead_status,
  p_next_status lead_status,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  current_status lead_status;
  normalized_reason text := nullif(trim(p_reason), '');
  is_terminal boolean;
  transition_allowed boolean;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'estimator']) then
    raise exception using errcode = '42501', message = 'Not authorized to update leads.';
  end if;

  select status
  into current_status
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Lead not found.';
  end if;

  if current_status <> p_expected_status then
    return jsonb_build_object(
      'ok', false,
      'code', 'STALE_STATUS',
      'message', 'The lead status changed before this request completed.'
    );
  end if;

  if current_status = p_next_status then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  is_terminal := current_status in ('won', 'unresponsive', 'disqualified', 'lost');

  if is_terminal then
    transition_allowed := public.has_any_role(array['owner', 'admin']);
  else
    transition_allowed := case current_status
      when 'new' then p_next_status in ('contacting', 'qualified', 'unresponsive', 'disqualified')
      when 'contacting' then p_next_status in ('qualified', 'unresponsive', 'disqualified', 'lost')
      when 'qualified' then p_next_status in ('estimate_pending', 'quote_pending', 'lost', 'disqualified')
      when 'estimate_pending' then p_next_status in ('quote_pending', 'lost', 'disqualified')
      when 'quote_pending' then p_next_status in ('won', 'lost', 'disqualified')
      else false
    end;
  end if;

  if not transition_allowed then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_TRANSITION',
      'message', format('Cannot move a lead from %s to %s.', current_status, p_next_status)
    );
  end if;

  if p_next_status in ('disqualified', 'lost') and normalized_reason is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'REASON_REQUIRED',
      'message', 'A reason is required for lost or disqualified leads.'
    );
  end if;

  update public.leads
  set
    status = p_next_status,
    lost_reason = case
      when p_next_status in ('disqualified', 'lost') then normalized_reason
      else null
    end,
    updated_at = now()
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
    current_status::text || ' -> ' || p_next_status::text,
    actor_id,
    jsonb_build_object('reason', normalized_reason)
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
    p_lead_id,
    'lead.status_changed',
    jsonb_build_object('status', current_status),
    jsonb_build_object('status', p_next_status, 'reason', normalized_reason)
  );

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

revoke all on function transition_lead_status(uuid, lead_status, lead_status, text)
  from public, anon;
grant execute on function transition_lead_status(uuid, lead_status, lead_status, text)
  to authenticated;

create or replace function add_lead_note_with_activity(
  p_lead_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  normalized_body text := trim(p_body);
  note_id uuid;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'estimator', 'dispatcher']) then
    raise exception using errcode = '42501', message = 'Not authorized to add lead notes.';
  end if;

  if nullif(normalized_body, '') is null then
    return jsonb_build_object('ok', false, 'message', 'Note body is required.');
  end if;

  insert into public.lead_notes (lead_id, author_id, body)
  values (p_lead_id, actor_id, normalized_body)
  returning id into note_id;

  insert into public.lead_activities (
    lead_id,
    activity_type,
    outcome,
    created_by
  )
  values (
    p_lead_id,
    'note_added',
    'Staff note added',
    actor_id
  );

  return jsonb_build_object('ok', true, 'noteId', note_id);
end;
$$;

revoke all on function add_lead_note_with_activity(uuid, text)
  from public, anon;
grant execute on function add_lead_note_with_activity(uuid, text)
  to authenticated;

-- Initial owner creation is serialized and atomic. It is service-role-only;
-- the application separately checks BOOTSTRAP_OWNER_EMAIL before invoking it.
create or replace function bootstrap_initial_owner(
  p_user_id uuid,
  p_email text,
  p_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  owner_role_id uuid;
  auth_email text;
begin
  perform pg_advisory_xact_lock(hashtextextended('bootstrap-initial-owner', 0));

  select email
  into auth_email
  from auth.users
  where id = p_user_id;

  if auth_email is null or lower(auth_email) <> lower(p_email) then
    return jsonb_build_object(
      'ok', false,
      'code', 'FORBIDDEN',
      'message', 'The authenticated user does not match the bootstrap request.'
    );
  end if;

  if exists (
    select 1
    from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where r.code = 'owner'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'CONFLICT',
      'message', 'An owner has already been bootstrapped.'
    );
  end if;

  select id into strict owner_role_id
  from public.roles
  where code = 'owner';

  insert into public.profiles (id, full_name, is_active)
  values (p_user_id, trim(p_full_name), true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      is_active = true,
      updated_at = now();

  insert into public.profile_roles (profile_id, role_id)
  values (p_user_id, owner_role_id);

  insert into public.audit_events (
    actor_profile_id,
    entity_type,
    entity_id,
    event_type,
    new_values
  )
  values (
    p_user_id,
    'profile',
    p_user_id,
    'auth.owner_bootstrapped',
    jsonb_build_object('email', lower(p_email))
  );

  return jsonb_build_object('ok', true);
exception
  when no_data_found then
    return jsonb_build_object(
      'ok', false,
      'code', 'INTERNAL_ERROR',
      'message', 'Owner role does not exist.'
    );
end;
$$;

revoke all on function bootstrap_initial_owner(uuid, text, text)
  from public, anon, authenticated;
grant execute on function bootstrap_initial_owner(uuid, text, text)
  to service_role;
