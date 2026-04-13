-- Coach hiyerarsisi icin org-scope RLS politikalari
-- Uygulama: Supabase SQL Editor veya migration pipeline
--
-- UYARI: public.profiles / public.organizations SELECT icin guncel kaynak
-- supabase/migrations (20260410_profiles_sporcu_policy_fix.sql,
-- 20260411_gate_rls_profiles_org_read_alignment.sql) dosyalaridir.
-- Bu dosyayi migration'lardan SONRA dikkatle calistirin; asagidaki
-- profiles_select_org_scope migration ile ayni olmayabilir (regression riski).

alter table if exists public.profiles enable row level security;
alter table if exists public.training_schedule enable row level security;
alter table if exists public.training_participants enable row level security;
alter table if exists public.athletic_results enable row level security;

drop policy if exists "profiles_select_org_scope" on public.profiles;
create policy "profiles_select_org_scope"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'admin'
        or (
          me.role = 'coach'
          and me.organization_id = profiles.organization_id
        )
        or (
          me.id = profiles.id
          and me.role = 'sporcu'
        )
      )
  )
);

drop policy if exists "profiles_insert_admin_coach" on public.profiles;
create policy "profiles_insert_admin_coach"
on public.profiles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'admin'
      and me.organization_id = profiles.organization_id
      and profiles.role in ('coach', 'sporcu')
  )
  or (
    auth.uid() = profiles.id
    and profiles.role = 'sporcu'
  )
);

drop policy if exists "profiles_update_org_scope" on public.profiles;
create policy "profiles_update_org_scope"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'admin'
        or (
          me.role = 'coach'
          and me.organization_id = profiles.organization_id
        )
        or me.id = profiles.id
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'admin'
        or (
          me.role = 'coach'
          and me.organization_id = profiles.organization_id
            and profiles.role = 'sporcu'
        )
        or me.id = profiles.id
      )
  )
);

drop policy if exists "training_schedule_org_scope" on public.training_schedule;
create policy "training_schedule_org_scope"
on public.training_schedule
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'admin'
        or (me.role = 'coach' and me.organization_id = training_schedule.organization_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'admin'
        or (me.role = 'coach' and me.organization_id = training_schedule.organization_id)
      )
  )
);

drop policy if exists "training_participants_org_scope" on public.training_participants;
create policy "training_participants_org_scope"
on public.training_participants
for all
to authenticated
using (
  exists (
    select 1
    from public.training_schedule ts
    join public.profiles me on me.id = auth.uid()
    where ts.id = training_participants.training_id
      and (
        me.role = 'admin'
        or (me.role = 'coach' and me.organization_id = ts.organization_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.training_schedule ts
    join public.profiles me on me.id = auth.uid()
    where ts.id = training_participants.training_id
      and (
        me.role = 'admin'
        or (me.role = 'coach' and me.organization_id = ts.organization_id)
      )
  )
);

drop policy if exists "athletic_results_org_scope" on public.athletic_results;
create policy "athletic_results_org_scope"
on public.athletic_results
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'admin'
        or (me.role = 'coach' and me.organization_id = athletic_results.organization_id)
        or (me.role = 'sporcu' and me.id = athletic_results.profile_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'admin'
        or (me.role = 'coach' and me.organization_id = athletic_results.organization_id)
        or (me.role = 'sporcu' and me.id = athletic_results.profile_id)
      )
  )
);
