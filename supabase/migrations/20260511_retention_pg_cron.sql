-- Faz 9.3 — Retention scheduler (pg_cron)
--
-- Hedef:
--   Faz 6'da eklenen `cleanup_read_notifications` ve `cleanup_audit_logs`
--   RPC'lerini Supabase pg_cron ile günlük olarak çalıştırmak.
--
-- Strateji:
--   1. pg_cron extension'ı yoksa idempotent şekilde kurulur (Supabase
--      ücretli planlarda hazır gelir; serbest planda bu migration
--      no-op olur — bkz. guard).
--   2. Cron schedule'ları tekrar çalıştırılabilir (CREATE OR REPLACE pattern).
--   3. Tüm cron job'lar UTC saatine göre çalışır:
--        - notifications cleanup: günlük 03:15 UTC (TR 06:15)
--        - audit logs cleanup:    günlük 03:30 UTC (TR 06:30)
--   4. Cron job adları `peaker_retention_*` prefix'i ile tanımlanır →
--      rollback `20260511_retention_pg_cron_rollback.sql` ile yapılabilir.
--   5. Retention günleri sabit (defaults: 90 gün notifications, 365 gün
--      audit logs). Değiştirmek için cron job'u unschedule + tekrar oluştur.
--
-- Health visibility:
--   pg_cron history `cron.job_run_details` tablosunda tutulur. Production'da
--   bu tabloya erişim için `SELECT ... FROM cron.job_run_details` kullanılabilir.
--   Uygulama tarafından `src/lib/monitoring/retentionHealth.ts` helper'ı
--   manuel tetikleme + structured log üretir.

-- 1) Extension guard. Supabase'in managed instance'larında genelde mevcut;
-- yoksa hata yutulur ve no-op olur.
do $$
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception
    when insufficient_privilege then
      raise notice 'pg_cron extension için yetersiz yetki — manual setup gerekli';
    when others then
      raise notice 'pg_cron extension yüklenemedi: %', sqlerrm;
  end;
end$$;

-- 2) Notifications cleanup cron (günlük 03:15 UTC).
do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    -- Var olan schedule'ı düşür (idempotent re-run).
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'peaker_retention_notifications';
    perform cron.schedule(
      'peaker_retention_notifications',
      '15 3 * * *',
      $cron$
        select public.cleanup_read_notifications(90);
      $cron$
    );
    raise notice 'peaker_retention_notifications scheduled (daily 03:15 UTC)';
  else
    raise notice 'pg_cron yok — peaker_retention_notifications atlandı';
  end if;
end$$;

-- 3) Audit logs cleanup cron (günlük 03:30 UTC).
do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'peaker_retention_audit_logs';
    perform cron.schedule(
      'peaker_retention_audit_logs',
      '30 3 * * *',
      $cron$
        select public.cleanup_audit_logs(365);
      $cron$
    );
    raise notice 'peaker_retention_audit_logs scheduled (daily 03:30 UTC)';
  else
    raise notice 'pg_cron yok — peaker_retention_audit_logs atlandı';
  end if;
end$$;

-- Health view (opsiyonel): son 7 günün cron run özetini bir view ile expose et.
-- pg_cron yoksa create view DO BLOCK içinde error yutulur (Supabase v15+
-- üzerinde sorun yok; defensive guard).
do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    execute $view$
      create or replace view public.peaker_retention_cron_health as
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
      where job.jobname in ('peaker_retention_notifications', 'peaker_retention_audit_logs')
        and run.start_time >= now() - interval '7 days'
      order by run.start_time desc;
    $view$;
    -- Sadece admin erişimi: anon/authenticated rolüne grant verme.
    raise notice 'peaker_retention_cron_health view oluşturuldu (sadece postgres rolü)';
  end if;
end$$;
