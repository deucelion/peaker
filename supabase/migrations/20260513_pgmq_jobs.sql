-- Faz 11.1 — pgmq tabanlı job queue altyapısı.
--
-- Hedef:
--   - Async iş kuyruğunu Postgres içinde (pgmq extension) tutmak.
--   - Producer: server action `enqueueJob` → `pgmq.send`.
--   - Consumer: pg_cron her dakika `pgmq.read` ile mesajları işler.
--   - Retry: bookkeeping `peaker_jobs_log` tablosunda.
--   - Idempotency: `peaker_jobs_log.idempotency_key` unique.
--   - DLQ: `peaker_jobs_dlq` ayrı pgmq queue.
--   - Cancellation: `peaker_jobs_cancellations` lookup tablosu.
--
-- Backward compatible:
--   - pgmq yoksa migration NOTICE üretir; uygulama `inMemoryAdapter`
--     ile mevcut davranışını sürdürür.
--   - Hiçbir mevcut tabloya forward dependency eklenmez.
--
-- Rollback:
--   `20260513_pgmq_jobs_rollback.sql` ile drop edilir.

-- 1) Audit/bookkeeping tablosu (her enqueue + status değişimi)
create table if not exists public.peaker_jobs_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete set null,
  job_kind text not null,
  idempotency_key text null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'duplicate', 'cancelled', 'dead_letter')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  payload jsonb not null default '{}'::jsonb,
  result jsonb null,
  error_kind text null,
  error_message text null,
  enqueued_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  next_run_at timestamptz null,
  pgmq_msg_id bigint null,
  initiator_kind text not null default 'user',
  initiator_id text null
);

create unique index if not exists peaker_jobs_log_idempotency_uniq
  on public.peaker_jobs_log (idempotency_key)
  where idempotency_key is not null;

create index if not exists peaker_jobs_log_org_status_idx
  on public.peaker_jobs_log (organization_id, status, enqueued_at desc);

create index if not exists peaker_jobs_log_kind_status_idx
  on public.peaker_jobs_log (job_kind, status, enqueued_at desc);

-- 2) Cancellation kayıt tablosu (consumer her processing öncesi kontrol)
create table if not exists public.peaker_jobs_cancellations (
  cancellation_key text primary key,
  job_kind text not null,
  organization_id uuid null,
  requested_at timestamptz not null default now(),
  requested_by uuid null,
  reason text null
);

-- 3) RLS: yalnızca service_role yazabilir, admin/super_admin okuyabilir.
alter table public.peaker_jobs_log enable row level security;
alter table public.peaker_jobs_cancellations enable row level security;

-- service_role full
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'peaker_jobs_log'
      and policyname = 'peaker_jobs_log_service'
  ) then
    execute $pol$create policy peaker_jobs_log_service on public.peaker_jobs_log
      for all to service_role using (true) with check (true)$pol$;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'peaker_jobs_cancellations'
      and policyname = 'peaker_jobs_cancellations_service'
  ) then
    execute $pol$create policy peaker_jobs_cancellations_service on public.peaker_jobs_cancellations
      for all to service_role using (true) with check (true)$pol$;
  end if;
end$$;

-- admin/super_admin read-only (paneller için)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'peaker_jobs_log'
      and policyname = 'peaker_jobs_log_admin_read'
  ) then
    execute $pol$create policy peaker_jobs_log_admin_read on public.peaker_jobs_log
      for select to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'super_admin')
            and (p.role = 'super_admin' or p.organization_id = peaker_jobs_log.organization_id)
        )
      )$pol$;
  end if;
end$$;

-- 4) pgmq queue oluştur (eğer extension varsa)
do $$
declare
  has_pgmq boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pgmq') into has_pgmq;
  if not has_pgmq then
    -- Supabase managed pgmq extension genelde public.pgmq schema'sında erişilebilir; yoksa skip.
    raise notice 'pgmq extension bulunamadı — job queue tabloları oluşturuldu ancak gerçek pgmq.send kullanılamaz. Faz 12''de aktive edilebilir.';
    return;
  end if;
  -- Standart queue
  begin
    perform pgmq.create('peaker_jobs');
    raise notice 'pgmq queue oluşturuldu: peaker_jobs';
  exception when others then
    raise notice 'pgmq queue zaten var ya da oluşturulamadı: %', sqlerrm;
  end;
  -- Dead-letter queue
  begin
    perform pgmq.create('peaker_jobs_dlq');
    raise notice 'pgmq DLQ oluşturuldu: peaker_jobs_dlq';
  exception when others then
    raise notice 'pgmq DLQ zaten var ya da oluşturulamadı: %', sqlerrm;
  end;
end$$;

-- 5) Enqueue helper RPC — server action bunu çağırır.
create or replace function public.peaker_enqueue_job(
  p_job_kind text,
  p_organization_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_max_attempts integer default 5,
  p_initiator_kind text default 'user',
  p_initiator_id text default null
)
returns table(
  log_id uuid,
  status text,
  pgmq_msg_id bigint
)
language plpgsql
security definer
set search_path = public, extensions, pgmq
as $$
declare
  v_existing uuid;
  v_log_id uuid;
  v_msg_id bigint;
  v_pgmq_available boolean := false;
begin
  -- Idempotency check
  if p_idempotency_key is not null then
    select id into v_existing
      from public.peaker_jobs_log
      where idempotency_key = p_idempotency_key
      limit 1;
    if v_existing is not null then
      return query select v_existing, 'duplicate'::text, null::bigint;
      return;
    end if;
  end if;

  -- pgmq mevcut mu?
  select exists (select 1 from pg_extension where extname = 'pgmq') into v_pgmq_available;

  if v_pgmq_available then
    begin
      v_msg_id := pgmq.send('peaker_jobs', p_payload);
    exception when others then
      v_msg_id := null;
      v_pgmq_available := false;
    end;
  end if;

  insert into public.peaker_jobs_log (
    job_kind, organization_id, idempotency_key,
    status, max_attempts, payload,
    pgmq_msg_id, initiator_kind, initiator_id,
    next_run_at
  ) values (
    p_job_kind, p_organization_id, p_idempotency_key,
    case when v_pgmq_available then 'queued' else 'queued' end,
    p_max_attempts, p_payload,
    v_msg_id, p_initiator_kind, p_initiator_id,
    now()
  )
  returning id into v_log_id;

  return query select v_log_id, 'queued'::text, v_msg_id;
end;
$$;

revoke all on function public.peaker_enqueue_job(text, uuid, jsonb, text, integer, text, text) from public;
revoke all on function public.peaker_enqueue_job(text, uuid, jsonb, text, integer, text, text) from anon;
revoke all on function public.peaker_enqueue_job(text, uuid, jsonb, text, integer, text, text) from authenticated;
-- service_role default execute.

-- 6) Cancellation helper
create or replace function public.peaker_cancel_job(
  p_cancellation_key text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.peaker_jobs_log
     set status = 'cancelled',
         finished_at = now(),
         error_kind = 'cancelled',
         error_message = coalesce(p_reason, 'Cancelled by request')
   where idempotency_key = p_cancellation_key
     and status in ('queued', 'running');
end;
$$;

revoke all on function public.peaker_cancel_job(text, text) from public;
revoke all on function public.peaker_cancel_job(text, text) from anon;
revoke all on function public.peaker_cancel_job(text, text) from authenticated;

-- 7) Bookkeeping view — admin paneli için son N job.
create or replace view public.peaker_recent_jobs as
  select id, organization_id, job_kind, status, attempts, max_attempts,
         enqueued_at, started_at, finished_at, error_kind, error_message,
         pgmq_msg_id, initiator_kind, initiator_id
    from public.peaker_jobs_log
   order by enqueued_at desc
   limit 200;

comment on table public.peaker_jobs_log is
  'Faz 11.1 — Async job kuyruğu kayıt tablosu. pgmq mesajı + status bookkeeping.';
comment on view public.peaker_recent_jobs is
  'Faz 11.1 — Son 200 job; admin/super_admin paneli için.';
