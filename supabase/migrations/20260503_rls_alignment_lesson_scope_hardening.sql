-- RLS hardening: align DB read scope with application rules.
-- Goal:
-- - coach default: own rows only
-- - coach with can_view_all_organization_lessons: org-wide lesson scope
-- - athlete: own rows only
-- - admin: own organization
-- - super_admin: full access

create or replace function public.rls_coach_can_view_all_org_lessons(
  p_user_id uuid,
  p_org_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_table boolean;
  has_column boolean;
  allowed boolean := false;
begin
  select to_regclass('public.coach_permissions') is not null into has_table;
  if not has_table then
    return false;
  end if;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'coach_permissions'
      and c.column_name = 'can_view_all_organization_lessons'
  )
  into has_column;

  if not has_column then
    return false;
  end if;

  execute $q$
    select exists (
      select 1
      from public.coach_permissions cp
      where cp.coach_id = $1
        and cp.organization_id = $2
        and coalesce(cp.can_view_all_organization_lessons, false) = true
    )
  $q$
  into allowed
  using p_user_id, p_org_id;

  return allowed;
end;
$$;

revoke all on function public.rls_coach_can_view_all_org_lessons(uuid, uuid) from public;
grant execute on function public.rls_coach_can_view_all_org_lessons(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- private_lesson_packages
-- ---------------------------------------------------------------------------
alter table if exists public.private_lesson_packages enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_lesson_packages'
      and policyname = 'private_lesson_packages_select_policy'
  ) then
    execute $q$
      alter policy private_lesson_packages_select_policy on public.private_lesson_packages
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.role = 'admin' and me.organization_id = private_lesson_packages.organization_id)
              or (
                me.role = 'coach'
                and me.organization_id = private_lesson_packages.organization_id
                and (
                  private_lesson_packages.coach_id = me.id
                  or public.rls_coach_can_view_all_org_lessons(me.id, me.organization_id)
                )
              )
              or (me.role = 'sporcu' and me.id = private_lesson_packages.athlete_id)
            )
        )
      )
    $q$;
  else
    execute $q$
      create policy private_lesson_packages_select_policy
      on public.private_lesson_packages
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.role = 'admin' and me.organization_id = private_lesson_packages.organization_id)
              or (
                me.role = 'coach'
                and me.organization_id = private_lesson_packages.organization_id
                and (
                  private_lesson_packages.coach_id = me.id
                  or public.rls_coach_can_view_all_org_lessons(me.id, me.organization_id)
                )
              )
              or (me.role = 'sporcu' and me.id = private_lesson_packages.athlete_id)
            )
        )
      )
    $q$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- private_lesson_sessions
-- ---------------------------------------------------------------------------
alter table if exists public.private_lesson_sessions enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_lesson_sessions'
      and policyname = 'private_lesson_sessions_select_policy'
  ) then
    execute $q$
      alter policy private_lesson_sessions_select_policy on public.private_lesson_sessions
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.role = 'admin' and me.organization_id = private_lesson_sessions.organization_id)
              or (
                me.role = 'coach'
                and me.organization_id = private_lesson_sessions.organization_id
                and (
                  private_lesson_sessions.coach_id = me.id
                  or public.rls_coach_can_view_all_org_lessons(me.id, me.organization_id)
                )
              )
              or (me.role = 'sporcu' and me.id = private_lesson_sessions.athlete_id)
            )
        )
      )
    $q$;
  else
    execute $q$
      create policy private_lesson_sessions_select_policy
      on public.private_lesson_sessions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.role = 'admin' and me.organization_id = private_lesson_sessions.organization_id)
              or (
                me.role = 'coach'
                and me.organization_id = private_lesson_sessions.organization_id
                and (
                  private_lesson_sessions.coach_id = me.id
                  or public.rls_coach_can_view_all_org_lessons(me.id, me.organization_id)
                )
              )
              or (me.role = 'sporcu' and me.id = private_lesson_sessions.athlete_id)
            )
        )
      )
    $q$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- private_lesson_payments
-- ---------------------------------------------------------------------------
alter table if exists public.private_lesson_payments enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_lesson_payments'
      and policyname = 'private_lesson_payments_select_policy'
  ) then
    execute $q$
      alter policy private_lesson_payments_select_policy on public.private_lesson_payments
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.role = 'admin' and me.organization_id = private_lesson_payments.organization_id)
              or (
                me.role = 'coach'
                and me.organization_id = private_lesson_payments.organization_id
                and (
                  private_lesson_payments.coach_id = me.id
                  or public.rls_coach_can_view_all_org_lessons(me.id, me.organization_id)
                )
              )
              or (me.role = 'sporcu' and me.id = private_lesson_payments.athlete_id)
            )
        )
      )
    $q$;
  else
    execute $q$
      create policy private_lesson_payments_select_policy
      on public.private_lesson_payments
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.role = 'admin' and me.organization_id = private_lesson_payments.organization_id)
              or (
                me.role = 'coach'
                and me.organization_id = private_lesson_payments.organization_id
                and (
                  private_lesson_payments.coach_id = me.id
                  or public.rls_coach_can_view_all_org_lessons(me.id, me.organization_id)
                )
              )
              or (me.role = 'sporcu' and me.id = private_lesson_payments.athlete_id)
            )
        )
      )
    $q$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- training_schedule
-- NOTE: policy names may vary by environment; replace all SELECT policies.
-- ---------------------------------------------------------------------------
alter table if exists public.training_schedule enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_schedule'
      and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.training_schedule', p.policyname);
  end loop;
end $$;

create policy training_schedule_select_scope_aligned
on public.training_schedule
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'super_admin'
        or (me.role = 'admin' and me.organization_id = training_schedule.organization_id)
        or (
          me.role = 'coach'
          and me.organization_id = training_schedule.organization_id
          and (
            training_schedule.coach_id = me.id
            or public.rls_coach_can_view_all_org_lessons(me.id, me.organization_id)
          )
        )
      )
  )
);

-- ---------------------------------------------------------------------------
-- training_participants (related lesson table)
-- NOTE: policy names may vary by environment; replace all SELECT policies.
-- ---------------------------------------------------------------------------
alter table if exists public.training_participants enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_participants'
      and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.training_participants', p.policyname);
  end loop;
end $$;

create policy training_participants_select_scope_aligned
on public.training_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    join public.training_schedule ts on ts.id = training_participants.training_id
    where me.id = auth.uid()
      and (
        me.role = 'super_admin'
        or (me.role = 'admin' and me.organization_id = ts.organization_id)
        or (
          me.role = 'coach'
          and me.organization_id = ts.organization_id
          and (
            ts.coach_id = me.id
            or public.rls_coach_can_view_all_org_lessons(me.id, me.organization_id)
          )
        )
        or (me.role = 'sporcu' and me.id = training_participants.profile_id)
      )
  )
);

-- ---------------------------------------------------------------------------
-- Financial read models not intended for coach direct access.
-- Keep admin/super_admin scope only.
-- ---------------------------------------------------------------------------
alter table if exists public.coach_payout_items enable row level security;
alter table if exists public.coach_payment_rules enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'coach_payout_items'
      and policyname = 'coach_payout_items_select_org_scope'
  ) then
    execute $q$
      alter policy coach_payout_items_select_org_scope on public.coach_payout_items
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.role = 'admin' and me.organization_id = coach_payout_items.organization_id)
            )
        )
      )
    $q$;
  else
    execute $q$
      create policy coach_payout_items_select_org_scope
      on public.coach_payout_items
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.role = 'admin' and me.organization_id = coach_payout_items.organization_id)
            )
        )
      )
    $q$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'coach_payment_rules'
      and policyname = 'coach_payment_rules_select_org_scope'
  ) then
    execute $q$
      alter policy coach_payment_rules_select_org_scope on public.coach_payment_rules
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.role = 'admin' and me.organization_id = coach_payment_rules.organization_id)
            )
        )
      )
    $q$;
  else
    execute $q$
      create policy coach_payment_rules_select_org_scope
      on public.coach_payment_rules
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.role = 'admin' and me.organization_id = coach_payment_rules.organization_id)
            )
        )
      )
    $q$;
  end if;
end $$;
