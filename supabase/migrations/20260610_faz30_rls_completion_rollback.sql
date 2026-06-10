-- ============================================================================
-- FAZ 30 ROLLBACK: RLS tamamlama geri alma
--
-- - Yeni select politikalari kaldirilir
-- - Bu migration ile YENI RLS acilan tablolarda RLS kapatilir
--   (payments, training_loads, wellness_reports, athlete_metrics,
--    test_definitions, athletic_results, athletic_result_notes)
-- - teams / coach_permissions / athlete_permissions eski JWT-claim
--   politikalarina dondurulur (RLS acik kalir — onceden de acikti)
-- - profiles / training_schedule / training_participants RLS'ine dokunulmaz
--   (onceden coach_org_scope.sql / 20260503 ile acikti)
-- ============================================================================

-- 1) Yeni politikalari kaldir + RLS kapat (bu migration'da yeni acilanlar)
drop policy if exists payments_select_org_scope on public.payments;
alter table if exists public.payments disable row level security;

drop policy if exists training_loads_select_scope on public.training_loads;
alter table if exists public.training_loads disable row level security;

drop policy if exists wellness_reports_select_scope on public.wellness_reports;
alter table if exists public.wellness_reports disable row level security;

drop policy if exists athlete_metrics_select_scope on public.athlete_metrics;
alter table if exists public.athlete_metrics disable row level security;

drop policy if exists test_definitions_select_scope on public.test_definitions;
alter table if exists public.test_definitions disable row level security;

drop policy if exists athletic_results_select_scope on public.athletic_results;
alter table if exists public.athletic_results disable row level security;

drop policy if exists athletic_result_notes_select_scope on public.athletic_result_notes;
alter table if exists public.athletic_result_notes disable row level security;

-- 2) teams — eski JWT-claim politikasina geri don
do $$
begin
  if to_regclass('public.teams') is null then return; end if;
  execute 'drop policy if exists teams_select_org_scope on public.teams';
  execute $q$
    create policy "teams_select_org_scope"
    on public.teams
    for select
    using (organization_id::text = auth.jwt() ->> 'organization_id')
  $q$;
end $$;

-- 3) coach_permissions — eski JWT-claim politikasina geri don
do $$
begin
  if to_regclass('public.coach_permissions') is null then return; end if;
  execute 'drop policy if exists coach_permissions_select_policy on public.coach_permissions';
  execute $q$
    create policy coach_permissions_select_policy on public.coach_permissions
    for select
    using (
      organization_id = (nullif(auth.jwt() ->> 'organization_id', '')::uuid)
      and (
        coalesce(auth.jwt() ->> 'role', '') = 'admin'
        or coach_id = auth.uid()
      )
    )
  $q$;
end $$;

-- 4) athlete_permissions — eski JWT-claim politikasina geri don
do $$
begin
  if to_regclass('public.athlete_permissions') is null then return; end if;
  execute 'drop policy if exists athlete_permissions_select_policy on public.athlete_permissions';
  execute $q$
    create policy athlete_permissions_select_policy on public.athlete_permissions
    for select
    using (
      organization_id = (nullif(auth.jwt() ->> 'organization_id', '')::uuid)
      and (
        coalesce(auth.jwt() ->> 'role', '') in ('admin', 'coach')
        or athlete_id = auth.uid()
      )
    )
  $q$;
end $$;
