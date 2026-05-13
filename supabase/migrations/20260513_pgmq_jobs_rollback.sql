-- Faz 11.1 rollback. NORMAL FORWARD CHAIN'DE ÇALIŞTIRILMAZ.
-- Manuel:
--   psql $DATABASE_URL -f supabase/migrations/20260513_pgmq_jobs_rollback.sql

drop view if exists public.peaker_recent_jobs;
drop function if exists public.peaker_cancel_job(text, text);
drop function if exists public.peaker_enqueue_job(text, uuid, jsonb, text, integer, text, text);

-- pgmq queue'ları drop et (pgmq extension varsa)
do $$
declare
  has_pgmq boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pgmq') into has_pgmq;
  if has_pgmq then
    begin perform pgmq.drop_queue('peaker_jobs'); exception when others then null; end;
    begin perform pgmq.drop_queue('peaker_jobs_dlq'); exception when others then null; end;
  end if;
end$$;

drop table if exists public.peaker_jobs_cancellations;
drop table if exists public.peaker_jobs_log;
