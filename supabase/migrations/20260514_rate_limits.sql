-- Faz 12.3 — Postgres tabanlı token-bucket rate limit tablosu.
--
-- Hedef:
--   Vercel multi-instance'ta paylaşımlı rate limit; Upstash alternatifi.
--   Tek round-trip atomic UPDATE/INSERT (RETURNING) ile token-bucket.
--
-- Performance:
--   - Tek satır UPDATE; index `(key) primary key`.
--   - Her check ~5-10ms (DB roundtrip).
--   - Stale satır otomatik cleanup yapılmaz; retention RPC ile siliyoruz
--     (Faz 12.6 entegrasyonu).
--
-- Rollback:
--   `20260514_rate_limits_rollback.sql` ile drop edilir.

create table if not exists public.peaker_rate_limits (
  rl_key text primary key,
  tokens numeric(12,4) not null,
  last_refill_ts bigint not null,
  capacity integer not null,
  window_ms integer not null,
  updated_at timestamptz not null default now()
);

create index if not exists peaker_rate_limits_updated_idx
  on public.peaker_rate_limits (updated_at);

alter table public.peaker_rate_limits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'peaker_rate_limits'
      and policyname = 'peaker_rate_limits_service'
  ) then
    execute $pol$create policy peaker_rate_limits_service on public.peaker_rate_limits
      for all to service_role using (true) with check (true)$pol$;
  end if;
end$$;

-- Atomic token-bucket check RPC.
create or replace function public.peaker_rate_limit_check(
  p_key text,
  p_capacity integer,
  p_window_ms integer
)
returns table(
  allowed boolean,
  remaining integer,
  retry_after_ms integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_state record;
  v_refill_rate numeric;
  v_elapsed numeric;
  v_refilled numeric;
  v_missing numeric;
  v_retry_after_ms integer;
  v_new_tokens numeric;
begin
  v_refill_rate := p_capacity::numeric / p_window_ms::numeric;

  -- Var olan bucket'ı çek (advisory lock ile race-safe).
  select tokens, last_refill_ts
    into v_state
    from public.peaker_rate_limits
    where rl_key = p_key
    for update;

  if v_state is null then
    -- İlk istek: capacity - 1 token bırak.
    insert into public.peaker_rate_limits (rl_key, tokens, last_refill_ts, capacity, window_ms, updated_at)
    values (p_key, p_capacity - 1, v_now_ms, p_capacity, p_window_ms, now())
    on conflict (rl_key) do update
      set tokens = excluded.tokens,
          last_refill_ts = excluded.last_refill_ts,
          capacity = excluded.capacity,
          window_ms = excluded.window_ms,
          updated_at = now();
    return query select true, (p_capacity - 1)::integer, 0;
    return;
  end if;

  v_elapsed := greatest(0, v_now_ms - v_state.last_refill_ts);
  v_refilled := least(p_capacity::numeric, v_state.tokens + v_elapsed * v_refill_rate);

  if v_refilled >= 1 then
    v_new_tokens := v_refilled - 1;
    update public.peaker_rate_limits
       set tokens = v_new_tokens,
           last_refill_ts = v_now_ms,
           capacity = p_capacity,
           window_ms = p_window_ms,
           updated_at = now()
     where rl_key = p_key;
    return query select true, floor(v_new_tokens)::integer, 0;
    return;
  end if;

  v_missing := 1 - v_refilled;
  v_retry_after_ms := ceil(v_missing / v_refill_rate)::integer;
  return query select false, 0, v_retry_after_ms;
end;
$$;

revoke all on function public.peaker_rate_limit_check(text, integer, integer) from public;
revoke all on function public.peaker_rate_limit_check(text, integer, integer) from anon;
revoke all on function public.peaker_rate_limit_check(text, integer, integer) from authenticated;

-- Retention helper: 24 saatten eski stale satırları siler (Faz 12.6 cron'a bağlanır).
create or replace function public.peaker_rate_limit_cleanup(
  p_retention_hours integer default 24
)
returns table(deleted_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if p_retention_hours < 1 then
    p_retention_hours := 1;
  end if;
  delete from public.peaker_rate_limits
    where updated_at < now() - (p_retention_hours || ' hours')::interval;
  get diagnostics v_count = row_count;
  return query select v_count;
end;
$$;

revoke all on function public.peaker_rate_limit_cleanup(integer) from public;
revoke all on function public.peaker_rate_limit_cleanup(integer) from anon;
revoke all on function public.peaker_rate_limit_cleanup(integer) from authenticated;

comment on table public.peaker_rate_limits is
  'Faz 12.3 — Postgres token-bucket rate limit (distributed adapter).';
comment on function public.peaker_rate_limit_check(text, integer, integer) is
  'Faz 12.3 — Atomic token-bucket check. service_role only.';
