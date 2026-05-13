-- Faz 12.1 — Worker pg_cron rollback.

do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'peaker_worker_tick';
    raise notice 'peaker_worker_tick unscheduled (if existed)';
  end if;
end$$;
