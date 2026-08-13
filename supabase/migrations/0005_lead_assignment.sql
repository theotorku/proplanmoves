-- Lead assignment: transactional ownership changes for the admin lead workspace.
-- Rollback note: pre-launch only, drop assign_lead, list_assignable_staff, and
-- the staff profile read policy.

-- Assignment shows and selects operator names, so every staff role needs to
-- read profile names. Role membership stays restricted to the owner/admin
-- policy plus the assignable-staff function below.
create policy profiles_staff_read on profiles
  for select to authenticated
  using (has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']));

create index if not exists leads_assigned_created_idx
  on leads(assigned_profile_id, created_at desc);

create or replace function list_assignable_staff()
returns table (staff_id uuid, staff_name text, staff_roles text[])
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null
    or not public.has_any_role(array['owner', 'admin', 'estimator', 'dispatcher', 'viewer']) then
    raise exception using errcode = '42501', message = 'Not authorized to list staff.';
  end if;

  return query
    select
      p.id,
      p.full_name,
      array_agg(r.code order by r.code)
    from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id
    join public.roles r on r.id = pr.role_id
    where p.is_active
    group by p.id, p.full_name
    having array_agg(r.code) && array['owner', 'admin', 'estimator', 'dispatcher']
    order by p.full_name;
end;
$$;

revoke all on function list_assignable_staff() from public, anon;
grant execute on function list_assignable_staff() to authenticated;

-- Assignment is a protected lifecycle mutation for the same reason status
-- changes are: the lead row, its activity, and its audit event must move
-- together, and authenticated clients hold no direct update grant on leads.
create or replace function assign_lead(
  p_lead_id uuid,
  p_expected_profile_id uuid,
  p_assignee_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  actor_is_manager boolean;
  current_assignee uuid;
  assignee_name text;
begin
  if actor_id is null
    or not public.has_any_role(array['owner', 'admin', 'estimator']) then
    raise exception using errcode = '42501', message = 'Not authorized to assign leads.';
  end if;

  actor_is_manager := public.has_any_role(array['owner', 'admin']);

  select assigned_profile_id
  into current_assignee
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Lead not found.';
  end if;

  if current_assignee is distinct from p_expected_profile_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'STALE_ASSIGNMENT',
      'message', 'The lead assignment changed before this request completed.'
    );
  end if;

  -- Estimators keep their own queue: they can claim an unassigned lead or
  -- release one they already own. Moving another operator's lead is an
  -- owner/admin decision.
  if not actor_is_manager and not (
    (
      p_assignee_profile_id is not distinct from actor_id
      and (current_assignee is null or current_assignee is not distinct from actor_id)
    )
    or (
      p_assignee_profile_id is null
      and current_assignee is not distinct from actor_id
    )
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'FORBIDDEN',
      'message', 'Only an owner or admin can change another operator''s lead assignment.'
    );
  end if;

  if current_assignee is not distinct from p_assignee_profile_id then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  if p_assignee_profile_id is not null then
    select p.full_name
    into assignee_name
    from public.profiles p
    where p.id = p_assignee_profile_id
      and p.is_active
      and exists (
        select 1
        from public.profile_roles pr
        join public.roles r on r.id = pr.role_id
        where pr.profile_id = p.id
          and r.code = any(array['owner', 'admin', 'estimator', 'dispatcher'])
      );

    if assignee_name is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'INVALID_ASSIGNEE',
        'message', 'The selected staff member cannot own leads.'
      );
    end if;
  end if;

  update public.leads
  set
    assigned_profile_id = p_assignee_profile_id,
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
    'assignment_changed',
    case
      when p_assignee_profile_id is null then 'Unassigned'
      else 'Assigned to ' || assignee_name
    end,
    actor_id,
    jsonb_build_object(
      'previousProfileId', current_assignee,
      'assignedProfileId', p_assignee_profile_id
    )
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
    'lead.assignment_changed',
    jsonb_build_object('assignedProfileId', current_assignee),
    jsonb_build_object('assignedProfileId', p_assignee_profile_id)
  );

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

revoke all on function assign_lead(uuid, uuid, uuid) from public, anon;
grant execute on function assign_lead(uuid, uuid, uuid) to authenticated;
