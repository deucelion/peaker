-- Faz 11.3 rollback. NORMAL FORWARD CHAIN'DE ÇALIŞTIRILMAZ.

do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'peaker_mv_daily_training_load_aggregates';
  end if;
end$$;

drop function if exists public.refresh_daily_training_load_aggregates();
drop materialized view if exists public.daily_training_load_aggregates cascade;
