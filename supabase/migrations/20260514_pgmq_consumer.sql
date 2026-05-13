-- Faz 12.1 — pgmq consumer helpers + worker heartbeat.
--
-- Hedef:
--   Gerçek async worker (Vercel route handler veya pg_cron+pg_net) için
--   pgmq operasyonlarını public schema'da SECURITY DEFINER RPC'leri ile
--   service_role'a expose etmek. Direct pgmq schema erişimi supabase-js
--   REST'inden çalışmadığı için bu wrapper'lar gerekli.
--
-- Backward compatible:
--   - pgmq extension yoksa RPC'ler boş array / "skipped" döndürür.
--   - Faz 11.1'den gelen `peaker_jobs_log`, `peaker_jobs_cancellations`,
--     `peaker_enqueue_job`, `peaker_cancel_job` davranışı korunur.
--
-- Rollback:
--   `20260514_pgmq_consumer_rollback.sql` ile drop edilir.

-- 1) Worker heartbeat tablosu — son N tick'in metrikleri.
create table if not exists public.peaker_worker_heartbeat (
  id uuid primary key default gen_random_uuid(),
  worker_id text not null,
  ticked_at timestamptz not null default now(),
  batch_size integer not null default 0,
  processed_count integer not null default 0,
  succeeded_count integer not null default 0,
  failed_count integer not null default 0,
  dead_letter_count integer not null default 0,
  duration_ms integer not null default 0,
  source text not null default 'unknown',
  notes text null
);

create index if not exists peaker_worker_heartbeat_ticked_idx
  on public.peaker_worker_heartbeat (ticked_at desc);

alter table public.peaker_worker_heartbeat enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'peaker_worker_heartbeat'
      and policyname = 'peaker_worker_heartbeat_service'
  ) then
    execute $pol$create policy peaker_worker_heartbeat_service on public.peaker_worker_heartbeat
      for all to service_role using (true) with check (true)$pol$;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'peaker_worker_heartbeat'
      and policyname = 'peaker_worker_heartbeat_admin_read'
  ) then
    execute $pol$create policy peaker_worker_heartbeat_admin_read on public.peaker_worker_heartbeat
      for select to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'super_admin')
        )
      )$pol$;
  end if;
end$$;

-- 2) Wrapper RPC: pgmq.read — visibility timeout altında N mesaj çek.
--    Mesaj envelope: { msg_id, read_ct, enqueued_at, vt, message }.
--    pgmq yoksa boş array döner.
create or replace function public.peaker_pgmq_read(
  p_queue_name text default 'peaker_jobs',
  p_visibility_seconds integer default 60,
  p_batch_size integer default 10
)
returns table(
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language plpgsql
security definer
set search_path = public, extensions, pgmq
as $$
declare
  v_has_pgmq boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pgmq') into v_has_pgmq;
  if not v_has_pgmq then
    return;
  end if;
  begin
    return query
      select r.msg_id::bigint, r.read_ct::integer, r.enqueued_at, r.vt, r.message
        from pgmq.read(p_queue_name, p_visibility_seconds, p_batch_size) r;
  exception when others then
    raise notice 'peaker_pgmq_read failed: %', sqlerrm;
    return;
  end;
end;
$$;

revoke all on function public.peaker_pgmq_read(text, integer, integer) from public;
revoke all on function public.peaker_pgmq_read(text, integer, integer) from anon;
revoke all on function public.peaker_pgmq_read(text, integer, integer) from authenticated;

-- 3) Wrapper RPC: pgmq.delete — başarılı işlenen mesajı kuyruktan sil.
create or replace function public.peaker_pgmq_delete(
  p_queue_name text,
  p_msg_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pgmq
as $$
declare
  v_has_pgmq boolean := false;
  v_ok boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pgmq') into v_has_pgmq;
  if not v_has_pgmq then
    return false;
  end if;
  begin
    v_ok := pgmq.delete(p_queue_name, p_msg_id);
    return v_ok;
  exception when others then
    raise notice 'peaker_pgmq_delete failed: %', sqlerrm;
    return false;
  end;
end;
$$;

revoke all on function public.peaker_pgmq_delete(text, bigint) from public;
revoke all on function public.peaker_pgmq_delete(text, bigint) from anon;
revoke all on function public.peaker_pgmq_delete(text, bigint) from authenticated;

-- 4) Wrapper RPC: pgmq.set_vt — visibility timeout uzatma (retry için).
--    seconds = exponential backoff yöneticisi tarafından hesaplanır.
create or replace function public.peaker_pgmq_set_vt(
  p_queue_name text,
  p_msg_id bigint,
  p_visibility_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pgmq
as $$
declare
  v_has_pgmq boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pgmq') into v_has_pgmq;
  if not v_has_pgmq then
    return false;
  end if;
  begin
    perform pgmq.set_vt(p_queue_name, p_msg_id, p_visibility_seconds);
    return true;
  exception when others then
    raise notice 'peaker_pgmq_set_vt failed: %', sqlerrm;
    return false;
  end;
end;
$$;

revoke all on function public.peaker_pgmq_set_vt(text, bigint, integer) from public;
revoke all on function public.peaker_pgmq_set_vt(text, bigint, integer) from anon;
revoke all on function public.peaker_pgmq_set_vt(text, bigint, integer) from authenticated;

-- 5) Wrapper RPC: pgmq.send — DLQ routing için (consumer max_attempts'ta gönderir).
create or replace function public.peaker_pgmq_send(
  p_queue_name text,
  p_payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, pgmq
as $$
declare
  v_has_pgmq boolean := false;
  v_msg_id bigint;
begin
  select exists (select 1 from pg_extension where extname = 'pgmq') into v_has_pgmq;
  if not v_has_pgmq then
    return null;
  end if;
  begin
    v_msg_id := pgmq.send(p_queue_name, p_payload);
    return v_msg_id;
  exception when others then
    raise notice 'peaker_pgmq_send failed: %', sqlerrm;
    return null;
  end;
end;
$$;

revoke all on function public.peaker_pgmq_send(text, jsonb) from public;
revoke all on function public.peaker_pgmq_send(text, jsonb) from anon;
revoke all on function public.peaker_pgmq_send(text, jsonb) from authenticated;

-- 6) Atomic transition helper: log status='running' + attempts++ — duplicate
--    execution guard. status zaten succeeded/dead_letter/cancelled ise no-op.
create or replace function public.peaker_jobs_mark_running(
  p_log_id uuid
)
returns table(
  log_id uuid,
  status text,
  attempts integer,
  proceed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  update public.peaker_jobs_log
     set status = 'running',
         attempts = attempts + 1,
         started_at = now()
   where id = p_log_id
     and status in ('queued', 'running')
   returning id, status, attempts into v_row;

  if v_row.id is null then
    -- Log var ama farklı statu (succeeded/cancelled/dead_letter) -> no-op.
    select id, status, attempts into v_row from public.peaker_jobs_log where id = p_log_id;
    if v_row.id is null then
      return query select null::uuid, 'missing'::text, 0::integer, false;
      return;
    end if;
    return query select v_row.id, v_row.status, coalesce(v_row.attempts, 0)::integer, false;
    return;
  end if;

  return query select v_row.id, v_row.status, v_row.attempts, true;
end;
$$;

revoke all on function public.peaker_jobs_mark_running(uuid) from public;
revoke all on function public.peaker_jobs_mark_running(uuid) from anon;
revoke all on function public.peaker_jobs_mark_running(uuid) from authenticated;

-- 7) Atomic transition helper: succeeded / failed / dead_letter.
create or replace function public.peaker_jobs_finalize(
  p_log_id uuid,
  p_status text,
  p_result jsonb default null,
  p_error_kind text default null,
  p_error_message text default null,
  p_next_run_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('succeeded', 'failed', 'dead_letter', 'cancelled') then
    raise exception 'peaker_jobs_finalize: invalid status %', p_status;
  end if;
  update public.peaker_jobs_log
     set status = p_status,
         result = coalesce(p_result, result),
         error_kind = case when p_status = 'succeeded' then null else coalesce(p_error_kind, error_kind) end,
         error_message = case when p_status = 'succeeded' then null else coalesce(p_error_message, error_message) end,
         finished_at = case when p_status in ('succeeded', 'failed', 'dead_letter', 'cancelled') then now() else finished_at end,
         next_run_at = p_next_run_at
   where id = p_log_id;
end;
$$;

revoke all on function public.peaker_jobs_finalize(uuid, text, jsonb, text, text, timestamptz) from public;
revoke all on function public.peaker_jobs_finalize(uuid, text, jsonb, text, text, timestamptz) from anon;
revoke all on function public.peaker_jobs_finalize(uuid, text, jsonb, text, text, timestamptz) from authenticated;

-- 8) Find peaker_jobs_log row by pgmq_msg_id (consumer'ın mesajdan loga
--    resolve etmesi için).
create or replace function public.peaker_jobs_lookup_by_msg(
  p_msg_id bigint
)
returns table(
  log_id uuid,
  job_kind text,
  organization_id uuid,
  idempotency_key text,
  status text,
  attempts integer,
  max_attempts integer,
  payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select id, job_kind, organization_id, idempotency_key, status, attempts, max_attempts, payload
      from public.peaker_jobs_log
      where pgmq_msg_id = p_msg_id
      order by enqueued_at desc
      limit 1;
end;
$$;

revoke all on function public.peaker_jobs_lookup_by_msg(bigint) from public;
revoke all on function public.peaker_jobs_lookup_by_msg(bigint) from anon;
revoke all on function public.peaker_jobs_lookup_by_msg(bigint) from authenticated;

comment on table public.peaker_worker_heartbeat is
  'Faz 12.1 — Async worker tick heartbeat metrikleri. /sistem-operasyonlari paneli için.';
comment on function public.peaker_pgmq_read(text, integer, integer) is
  'Faz 12.1 — pgmq.read wrapper. service_role only.';
comment on function public.peaker_jobs_mark_running(uuid) is
  'Faz 12.1 — Idempotent transition queued/running -> running, attempts++. Duplicate execution guard.';
