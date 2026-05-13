-- Faz 12.6 — Queue retention & cleanup.
--
-- Hedef:
--   `peaker_jobs_log`, `peaker_worker_heartbeat` ve pgmq queue archive
--   (`pgmq.archive`) için retention policy + pg_cron schedule.
--
-- Davranış:
--   - Default retention günleri:
--     * peaker_jobs_log (succeeded/cancelled/duplicate): 30 gün
--     * peaker_jobs_log (failed/dead_letter): 90 gün
--     * peaker_worker_heartbeat: 7 gün
--     * pgmq archive (DLQ tail): 60 gün (pgmq destekliyorsa)
--   - Tüm cleanup'lar `peaker_cleanup_jobs_retention` RPC'sinde toplanır.
--   - pg_cron yoksa migration no-op (warning).
--   - pgmq yoksa archive cleanup no-op (warning).
--
-- Backward compatible:
--   - Hiçbir mevcut tabloyu drop etmiyor; sadece eski satırları temizliyor.
--   - Cleanup count'ları telemetry için döner.
--
-- Rollback:
--   `20260515_jobs_retention_rollback.sql` ile cron unschedule + RPC drop.
--   Eski log satırları geri yüklenmez (zaten silinmiş).

create or replace function public.peaker_cleanup_jobs_retention(
  p_terminal_days integer default 30,
  p_failed_days integer default 90,
  p_heartbeat_days integer default 7,
  p_archive_days integer default 60
)
returns table(
  scope text,
  removed_count bigint
)
language plpgsql
security definer
set search_path = public, extensions, pgmq
as $$
declare
  v_count_terminal bigint := 0;
  v_count_failed bigint := 0;
  v_count_heartbeat bigint := 0;
  v_count_archive bigint := 0;
  v_has_pgmq boolean := false;
begin
  -- 1) Terminal status retention (succeeded / cancelled / duplicate)
  with deleted as (
    delete from public.peaker_jobs_log
     where status in ('succeeded', 'cancelled', 'duplicate')
       and finished_at is not null
       and finished_at < now() - make_interval(days => greatest(p_terminal_days, 1))
    returning 1
  )
  select count(*) into v_count_terminal from deleted;

  -- 2) Failed / dead_letter retention (uzun saklama, debugging için)
  with deleted as (
    delete from public.peaker_jobs_log
     where status in ('failed', 'dead_letter')
       and finished_at is not null
       and finished_at < now() - make_interval(days => greatest(p_failed_days, 1))
    returning 1
  )
  select count(*) into v_count_failed from deleted;

  -- 3) Worker heartbeat retention
  with deleted as (
    delete from public.peaker_worker_heartbeat
     where ticked_at < now() - make_interval(days => greatest(p_heartbeat_days, 1))
    returning 1
  )
  select count(*) into v_count_heartbeat from deleted;

  -- 4) pgmq archive purge (best-effort)
  select exists (select 1 from pg_extension where extname = 'pgmq') into v_has_pgmq;
  if v_has_pgmq then
    begin
      -- pgmq.purge_queue archive table (peaker_jobs_dlq archive)
      execute format(
        'delete from pgmq.a_%I where archived_at < now() - make_interval(days => $1)',
        'peaker_jobs_dlq'
      )
      using greatest(p_archive_days, 1);
      get diagnostics v_count_archive = row_count;
    exception when others then
      raise notice 'pgmq archive cleanup skipped: %', sqlerrm;
      v_count_archive := 0;
    end;
  end if;

  return query
    values
      ('terminal', v_count_terminal),
      ('failed', v_count_failed),
      ('heartbeat', v_count_heartbeat),
      ('archive', v_count_archive);
end;
$$;

revoke all on function public.peaker_cleanup_jobs_retention(integer, integer, integer, integer) from public;
revoke all on function public.peaker_cleanup_jobs_retention(integer, integer, integer, integer) from anon;
revoke all on function public.peaker_cleanup_jobs_retention(integer, integer, integer, integer) from authenticated;

comment on function public.peaker_cleanup_jobs_retention(integer, integer, integer, integer) is
  'Faz 12.6 — Job log + heartbeat + pgmq archive retention cleanup. Returns per-scope removed_count.';

-- 5) Health view: son 14 günün cleanup özetini cron history üzerinden expose et.
do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    execute $view$
      create or replace view public.peaker_jobs_retention_cron_health as
      select
        job.jobname,
        run.runid,
        run.start_time,
        run.end_time,
        run.status,
        run.return_message,
        case
          when run.end_time is null then null
          else extract(epoch from (run.end_time - run.start_time)) * 1000
        end as duration_ms
      from cron.job_run_details run
      join cron.job on job.jobid = run.jobid
      where job.jobname = 'peaker_jobs_retention'
        and run.start_time >= now() - interval '14 days'
      order by run.start_time desc;
    $view$;
    raise notice 'peaker_jobs_retention_cron_health view oluşturuldu';
  end if;
end$$;

-- 6) Cron schedule (günlük 03:45 UTC) — diğer retention'lardan sonra çalışsın.
do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'peaker_jobs_retention';
    perform cron.schedule(
      'peaker_jobs_retention',
      '45 3 * * *',
      $cron$
        select public.peaker_cleanup_jobs_retention(30, 90, 7, 60);
      $cron$
    );
    raise notice 'peaker_jobs_retention scheduled (daily 03:45 UTC)';
  else
    raise notice 'pg_cron yok — peaker_jobs_retention atlandı (manuel tetik gerekli)';
  end if;
end$$;
