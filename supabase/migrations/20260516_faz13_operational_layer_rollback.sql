-- Faz 13 operational layer rollback (non-destructive reverse).

do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'peaker_rate_limit_cleanup';
  end if;
end$$;

drop function if exists public.peaker_jobs_purge_completed_for_org(uuid, integer);
drop function if exists public.peaker_jobs_rescue_stuck(integer);

drop table if exists public.peaker_operational_timeline;
drop table if exists public.peaker_operational_alerts;

alter table public.peaker_worker_heartbeat
  drop column if exists rescue_rescued_count,
  drop column if exists rescue_dead_stuck_count,
  drop column if exists retry_storm_detected;
