-- Faz 12.6 rollback — peaker_jobs_retention cron + RPC + view drop.
--
-- Not: Bu rollback yalnızca retention zamanlama ve yardımcılarını kaldırır.
-- Önceki cleanup'larda silinen log satırları geri yüklenmez (geçmiş veri).

do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'peaker_jobs_retention';
    raise notice 'peaker_jobs_retention cron job unscheduled';
  end if;
end$$;

drop view if exists public.peaker_jobs_retention_cron_health;

drop function if exists public.peaker_cleanup_jobs_retention(integer, integer, integer, integer);
