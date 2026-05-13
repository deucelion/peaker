-- Faz 11.3 — `daily_training_load_aggregates` materialized view.
--
-- Hedef:
--   1000+ sporcu × 90 günlük performans takım görünümünde ACWR/EWMA
--   hesabı için pre-aggregated günlük toplam yük + RPE + session sayısı.
--
-- Backward compatible:
--   - Mevcut `listPerformanceAnalyticsData` AYNI tablo (`training_loads`)
--     üzerinden çalışmaya devam eder. MV read path Faz 12'de aktive edilecek.
--
-- Refresh:
--   pg_cron her 6 saatte bir (`*/360 * * * *` yerine `0 */6 * * *`).
--   Stale tolerance: 6 saat.

create materialized view if not exists public.daily_training_load_aggregates as
select
  p.organization_id,
  tl.profile_id,
  tl.measurement_date as training_day,
  coalesce(sum(tl.total_load), 0)::numeric(12,2) as total_load,
  case
    when count(tl.rpe_score) > 0 then (sum(coalesce(tl.rpe_score, 0))::numeric / nullif(count(tl.rpe_score), 0))::numeric(6,2)
    else null
  end as avg_rpe,
  count(*)::integer as session_count,
  max(tl.measurement_date) as last_recorded_at,
  now() as refreshed_at
from public.training_loads tl
join public.profiles p on p.id = tl.profile_id
where p.organization_id is not null
  and tl.measurement_date is not null
group by p.organization_id, tl.profile_id, tl.measurement_date;

-- Unique index (REFRESH CONCURRENTLY için zorunlu)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'daily_training_load_aggregates'
      and indexname = 'daily_training_load_aggregates_uniq'
  ) then
    create unique index daily_training_load_aggregates_uniq
      on public.daily_training_load_aggregates (organization_id, profile_id, training_day);
  end if;
end$$;

-- Range scan index (org bazlı + date range)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'daily_training_load_aggregates'
      and indexname = 'daily_training_load_aggregates_org_day_idx'
  ) then
    create index daily_training_load_aggregates_org_day_idx
      on public.daily_training_load_aggregates (organization_id, training_day desc);
  end if;
end$$;

-- Erişim yetkisi: yalnızca service_role.
revoke all on public.daily_training_load_aggregates from public;
revoke all on public.daily_training_load_aggregates from anon;
revoke all on public.daily_training_load_aggregates from authenticated;

-- pg_cron — 6 saatte bir refresh.
do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'peaker_mv_daily_training_load_aggregates';
    perform cron.schedule(
      'peaker_mv_daily_training_load_aggregates',
      '0 */6 * * *',
      $cron$
        refresh materialized view concurrently public.daily_training_load_aggregates;
      $cron$
    );
    raise notice 'peaker_mv_daily_training_load_aggregates scheduled (every 6h)';
  else
    raise notice 'pg_cron yok — MV refresh cron atlandı';
  end if;
end$$;

-- Manuel refresh RPC.
create or replace function public.refresh_daily_training_load_aggregates()
returns table(refreshed_at timestamptz, row_count bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count bigint;
begin
  refresh materialized view concurrently public.daily_training_load_aggregates;
  select count(*) into v_count from public.daily_training_load_aggregates;
  return query select now() as refreshed_at, v_count;
end;
$$;

revoke all on function public.refresh_daily_training_load_aggregates() from public;
revoke all on function public.refresh_daily_training_load_aggregates() from anon;
revoke all on function public.refresh_daily_training_load_aggregates() from authenticated;

comment on materialized view public.daily_training_load_aggregates is
  'Faz 11.3 — Sporcu × gün × toplam yük / avg rpe / session_count. organization_id + profile_id + training_day unique. 6h refresh.';
