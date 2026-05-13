-- Faz 12.1 — pgmq consumer helpers rollback.

drop function if exists public.peaker_jobs_lookup_by_msg(bigint);
drop function if exists public.peaker_jobs_finalize(uuid, text, jsonb, text, text, timestamptz);
drop function if exists public.peaker_jobs_mark_running(uuid);
drop function if exists public.peaker_pgmq_send(text, jsonb);
drop function if exists public.peaker_pgmq_set_vt(text, bigint, integer);
drop function if exists public.peaker_pgmq_delete(text, bigint);
drop function if exists public.peaker_pgmq_read(text, integer, integer);

drop policy if exists peaker_worker_heartbeat_admin_read on public.peaker_worker_heartbeat;
drop policy if exists peaker_worker_heartbeat_service on public.peaker_worker_heartbeat;
drop index if exists public.peaker_worker_heartbeat_ticked_idx;
drop table if exists public.peaker_worker_heartbeat;
