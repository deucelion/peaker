-- ============================================================================
-- FAZ 30: RLS TAMAMLAMA
--
-- Hedefler:
-- 1) RLS'siz is tablolarini kapat: payments, training_loads, wellness_reports,
--    athlete_metrics, test_definitions, athletic_results, athletic_result_notes
-- 2) profiles / training_schedule / training_participants icin "enable row level
--    security" komutunu manuel calistirilan supabase/policies/coach_org_scope.sql
--    yerine migration pipeline'ina tasi
-- 3) JWT-claim bazli eski politikalari (teams, coach_permissions,
--    athlete_permissions) profiles subquery stiline migrate et — Faz 29 ile
--    user_metadata claim'leri guvenilmez kabul edildigi icin politika kaynaklari
--    da profiles tablosuna hizalanir
--
-- Not: Uygulama bu tablolara server action'larda service-role (admin client) ile
-- erisir; service-role RLS'i bypass eder. Bu politikalar tarayici/anon session
-- istemci yuzeyini kapatir. Davranis degisikligi beklenmez.
-- Stil: 20260503_rls_alignment_lesson_scope_hardening.sql ile ayni.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) coach_org_scope.sql bagimliligindaki enable RLS komutlari (idempotent)
-- ----------------------------------------------------------------------------
alter table if exists public.profiles enable row level security;
alter table if exists public.training_schedule enable row level security;
alter table if exists public.training_participants enable row level security;

-- ----------------------------------------------------------------------------
-- 1) payments — admin org-scope, sporcu kendi satirlari, super_admin tam erisim
-- ----------------------------------------------------------------------------
do $$
declare p record;
begin
  if to_regclass('public.payments') is null then return; end if;
  execute 'alter table public.payments enable row level security';
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'payments' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.payments', p.policyname);
  end loop;
  execute $q$
    create policy payments_select_org_scope
    on public.payments
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles me
        where me.id = auth.uid()
          and (
            me.role = 'super_admin'
            or (me.role = 'admin' and me.organization_id = payments.organization_id)
            or (me.role = 'sporcu' and me.id = payments.profile_id)
          )
      )
    )
  $q$;
end $$;

-- ----------------------------------------------------------------------------
-- 2) training_loads — saglik/yuk verisi: org-scope (hedef sporcunun org'u
--    uzerinden), sporcu kendi satirlari
-- ----------------------------------------------------------------------------
do $$
declare p record;
begin
  if to_regclass('public.training_loads') is null then return; end if;
  execute 'alter table public.training_loads enable row level security';
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'training_loads' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.training_loads', p.policyname);
  end loop;
  execute $q$
    create policy training_loads_select_scope
    on public.training_loads
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles me
        join public.profiles target on target.id = training_loads.profile_id
        where me.id = auth.uid()
          and (
            me.role = 'super_admin'
            or (
              me.role in ('admin', 'coach')
              and me.organization_id is not null
              and me.organization_id = target.organization_id
            )
            or (me.role = 'sporcu' and me.id = training_loads.profile_id)
          )
      )
    )
  $q$;
end $$;

-- ----------------------------------------------------------------------------
-- 3) wellness_reports — saglik verisi: training_loads ile ayni kapsam
-- ----------------------------------------------------------------------------
do $$
declare p record;
begin
  if to_regclass('public.wellness_reports') is null then return; end if;
  execute 'alter table public.wellness_reports enable row level security';
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'wellness_reports' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.wellness_reports', p.policyname);
  end loop;
  execute $q$
    create policy wellness_reports_select_scope
    on public.wellness_reports
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles me
        join public.profiles target on target.id = wellness_reports.profile_id
        where me.id = auth.uid()
          and (
            me.role = 'super_admin'
            or (
              me.role in ('admin', 'coach')
              and me.organization_id is not null
              and me.organization_id = target.organization_id
            )
            or (me.role = 'sporcu' and me.id = wellness_reports.profile_id)
          )
      )
    )
  $q$;
end $$;

-- ----------------------------------------------------------------------------
-- 4) athlete_metrics — vucut olcumleri: ayni profil-join kapsami
-- ----------------------------------------------------------------------------
do $$
declare p record;
begin
  if to_regclass('public.athlete_metrics') is null then return; end if;
  execute 'alter table public.athlete_metrics enable row level security';
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'athlete_metrics' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.athlete_metrics', p.policyname);
  end loop;
  execute $q$
    create policy athlete_metrics_select_scope
    on public.athlete_metrics
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles me
        join public.profiles target on target.id = athlete_metrics.profile_id
        where me.id = auth.uid()
          and (
            me.role = 'super_admin'
            or (
              me.role in ('admin', 'coach')
              and me.organization_id is not null
              and me.organization_id = target.organization_id
            )
            or (me.role = 'sporcu' and me.id = athlete_metrics.profile_id)
          )
      )
    )
  $q$;
end $$;

-- ----------------------------------------------------------------------------
-- 5) athletic_results — coach_org_scope.sql'deki politika migration'a tasinir
--    (organization_id + profile_id kolonlari mevcut)
-- ----------------------------------------------------------------------------
do $$
declare p record;
begin
  if to_regclass('public.athletic_results') is null then return; end if;
  execute 'alter table public.athletic_results enable row level security';
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'athletic_results' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.athletic_results', p.policyname);
  end loop;
  execute $q$
    create policy athletic_results_select_scope
    on public.athletic_results
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles me
        where me.id = auth.uid()
          and (
            me.role = 'super_admin'
            or (me.role in ('admin', 'coach') and me.organization_id = athletic_results.organization_id)
            or (me.role = 'sporcu' and me.id = athletic_results.profile_id)
          )
      )
    )
  $q$;
end $$;

-- ----------------------------------------------------------------------------
-- 6) athletic_result_notes — saha testi gunu notlari
-- ----------------------------------------------------------------------------
do $$
declare p record;
begin
  if to_regclass('public.athletic_result_notes') is null then return; end if;
  execute 'alter table public.athletic_result_notes enable row level security';
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'athletic_result_notes' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.athletic_result_notes', p.policyname);
  end loop;
  execute $q$
    create policy athletic_result_notes_select_scope
    on public.athletic_result_notes
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles me
        where me.id = auth.uid()
          and (
            me.role = 'super_admin'
            or (me.role in ('admin', 'coach') and me.organization_id = athletic_result_notes.organization_id)
            or (me.role = 'sporcu' and me.id = athletic_result_notes.profile_id)
          )
      )
    )
  $q$;
end $$;

-- ----------------------------------------------------------------------------
-- 7) test_definitions — sema drift'i var (organization_id / org_id / kolonsuz).
--    Mevcut kolona gore org-scope; org kolonu yoksa yalnizca authenticated okuma
--    (katalog tablosu, hassas veri icermez).
-- ----------------------------------------------------------------------------
do $$
declare
  p record;
  has_organization_id boolean;
  has_org_id boolean;
begin
  if to_regclass('public.test_definitions') is null then return; end if;
  execute 'alter table public.test_definitions enable row level security';
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'test_definitions' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.test_definitions', p.policyname);
  end loop;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'test_definitions' and column_name = 'organization_id'
  ) into has_organization_id;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'test_definitions' and column_name = 'org_id'
  ) into has_org_id;

  if has_organization_id then
    execute $q$
      create policy test_definitions_select_scope
      on public.test_definitions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.organization_id is not null and me.organization_id = test_definitions.organization_id)
            )
        )
      )
    $q$;
  elsif has_org_id then
    execute $q$
      create policy test_definitions_select_scope
      on public.test_definitions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and (
              me.role = 'super_admin'
              or (me.organization_id is not null and me.organization_id = test_definitions.org_id)
            )
        )
      )
    $q$;
  else
    execute $q$
      create policy test_definitions_select_scope
      on public.test_definitions
      for select
      to authenticated
      using (auth.uid() is not null)
    $q$;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 8) teams — JWT-claim politikasi profiles subquery stiline migrate edilir
--    (eski: organization_id::text = auth.jwt() ->> 'organization_id')
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.teams') is null then return; end if;
  execute 'alter table public.teams enable row level security';
  execute 'drop policy if exists "teams_select_org_scope" on public.teams';
  execute $q$
    create policy teams_select_org_scope
    on public.teams
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles me
        where me.id = auth.uid()
          and (
            me.role = 'super_admin'
            or (me.organization_id is not null and me.organization_id = teams.organization_id)
          )
      )
    )
  $q$;
end $$;

-- ----------------------------------------------------------------------------
-- 9) coach_permissions — JWT-claim politikasi profiles subquery stiline
--    (proxy session istemcisiyle okudugu icin politika guvenilir olmali)
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.coach_permissions') is null then return; end if;
  execute 'alter table public.coach_permissions enable row level security';
  execute 'drop policy if exists coach_permissions_select_policy on public.coach_permissions';
  execute $q$
    create policy coach_permissions_select_policy
    on public.coach_permissions
    for select
    to authenticated
    using (
      coach_id = auth.uid()
      or exists (
        select 1
        from public.profiles me
        where me.id = auth.uid()
          and (
            me.role = 'super_admin'
            or (me.role = 'admin' and me.organization_id = coach_permissions.organization_id)
          )
      )
    )
  $q$;
end $$;

-- ----------------------------------------------------------------------------
-- 10) athlete_permissions — JWT-claim politikasi profiles subquery stiline
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.athlete_permissions') is null then return; end if;
  execute 'alter table public.athlete_permissions enable row level security';
  execute 'drop policy if exists athlete_permissions_select_policy on public.athlete_permissions';
  execute $q$
    create policy athlete_permissions_select_policy
    on public.athlete_permissions
    for select
    to authenticated
    using (
      athlete_id = auth.uid()
      or exists (
        select 1
        from public.profiles me
        where me.id = auth.uid()
          and (
            me.role = 'super_admin'
            or (me.role in ('admin', 'coach') and me.organization_id = athlete_permissions.organization_id)
          )
      )
    )
  $q$;
end $$;
