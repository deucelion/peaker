-- Faz 9.3 — Retention pg_cron rollback.
--
-- Bu migration NORMAL FORWARD CHAIN'DE ÇALIŞTIRILMAZ.
-- Production'da manuel olarak `psql` ile uygulanır:
--   psql $DATABASE_URL -f supabase/migrations/20260511_retention_pg_cron_rollback.sql
--
-- Cron job'ları siler ve health view'i drop eder. RPC fonksiyonları
-- (cleanup_*) ETKİLENMEZ — onlar Faz 6 migration'ında tanımlı.

do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname in (
        'peaker_retention_notifications',
        'peaker_retention_audit_logs'
      );
    raise notice 'peaker retention cron job''ları silindi';
  end if;
end$$;

drop view if exists public.peaker_retention_cron_health;
