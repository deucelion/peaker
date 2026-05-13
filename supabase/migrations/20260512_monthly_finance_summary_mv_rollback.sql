-- Faz 10.3 — `monthly_finance_summary` MV rollback.
--
-- Bu migration NORMAL FORWARD CHAIN'DE ÇALIŞTIRILMAZ.
-- Manuel:
--   psql $DATABASE_URL -f supabase/migrations/20260512_monthly_finance_summary_mv_rollback.sql

do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'peaker_mv_monthly_finance_summary';
    raise notice 'peaker_mv_monthly_finance_summary cron silindi';
  end if;
end$$;

drop function if exists public.refresh_monthly_finance_summary();
drop materialized view if exists public.monthly_finance_summary cascade;
