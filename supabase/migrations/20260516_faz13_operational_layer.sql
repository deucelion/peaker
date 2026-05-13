-- Faz 13 — Operational hardening: stuck job rescue, operational alerts/timeline,
-- worker heartbeat metrics, rate-limit cleanup cron.
--
-- Non-destructive: new columns (nullable defaults), new tables, new RPCs.
-- Rollback: 20260516_faz13_operational_layer_rollback.sql

-- 1) Worker heartbeat — recovery metrics (nullable defaults, backward compatible).
alter table public.peaker_worker_heartbeat
  add column if not exists rescue_rescued_count integer not null default 0,
  add column if not exists rescue_dead_stuck_count integer not null default 0,
  add column if not exists retry_storm_detected boolean not null default false;

comment on column public.peaker_worker_heartbeat.rescue_rescued_count is
  'Faz 13.1 — Stuck running jobs requeued in same tick.';
comment on column public.peaker_worker_heartbeat.rescue_dead_stuck_count is
  'Faz 13.1 — Stuck running jobs finalized as dead_letter (max attempts).';
comment on column public.peaker_worker_heartbeat.retry_storm_detected is
  'Faz 13.1 — True if advanced telemetry reported retry storm this tick.';

-- 2) Operational alerts (persisted; admin resolves or auto-resolve via evaluator).
create table if not exists public.peaker_operational_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete set null,
  rule_key text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists peaker_operational_alerts_open_idx
  on public.peaker_operational_alerts (organization_id, resolved_at, created_at desc);

-- Aynı kural için tek açık uyarı (upsert / resolve senkronu için).
create unique index if not exists peaker_operational_alerts_open_rule_uniq
  on public.peaker_operational_alerts (rule_key)
  where resolved_at is null;

alter table public.peaker_operational_alerts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'peaker_operational_alerts'
      and policyname = 'peaker_operational_alerts_service'
  ) then
    execute $pol$create policy peaker_operational_alerts_service on public.peaker_operational_alerts
      for all to service_role using (true) with check (true)$pol$;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'peaker_operational_alerts'
      and policyname = 'peaker_operational_alerts_admin_read'
  ) then
    execute $pol$create policy peaker_operational_alerts_admin_read on public.peaker_operational_alerts
      for select to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'super_admin')
            and (
              p.role = 'super_admin'
              or peaker_operational_alerts.organization_id is null
              or p.organization_id = peaker_operational_alerts.organization_id
            )
        )
      )$pol$;
  end if;
end$$;

-- 3) Operational timeline (append-only audit stream for ops dashboard).
create table if not exists public.peaker_operational_timeline (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists peaker_operational_timeline_org_created_idx
  on public.peaker_operational_timeline (organization_id, created_at desc);

create index if not exists peaker_operational_timeline_created_idx
  on public.peaker_operational_timeline (created_at desc);

alter table public.peaker_operational_timeline enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'peaker_operational_timeline'
      and policyname = 'peaker_operational_timeline_service'
  ) then
    execute $pol$create policy peaker_operational_timeline_service on public.peaker_operational_timeline
      for all to service_role using (true) with check (true)$pol$;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'peaker_operational_timeline'
      and policyname = 'peaker_operational_timeline_admin_read'
  ) then
    execute $pol$create policy peaker_operational_timeline_admin_read on public.peaker_operational_timeline
      for select to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'super_admin')
            and (
              p.role = 'super_admin'
              or peaker_operational_timeline.organization_id is null
              or p.organization_id = peaker_operational_timeline.organization_id
            )
        )
      )$pol$;
  end if;
end$$;

-- 4) Stuck job rescue — running + started_at older than threshold.
create or replace function public.peaker_jobs_rescue_stuck(p_after_seconds integer default 600)
returns table(rescued_count bigint, dead_stuck_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_after integer := greatest(coalesce(p_after_seconds, 600), 60);
  v_rescued bigint := 0;
  v_dead bigint := 0;
begin
  with stuck as (
    select id, attempts, max_attempts
      from public.peaker_jobs_log
     where status = 'running'
       and started_at is not null
       and finished_at is null
       and started_at < now() - (interval '1 second' * v_after)
     order by started_at asc
     limit 200
     for update skip locked
  ),
  r as (
    update public.peaker_jobs_log j
       set status = 'queued',
           error_kind = 'stuck_recovered',
           error_message = 'Stuck running job requeued (heartbeat/timeout rescue)',
           next_run_at = now(),
           started_at = null,
           finished_at = null
      from stuck s
     where j.id = s.id
       and s.attempts < s.max_attempts
     returning j.id
  ),
  d as (
    update public.peaker_jobs_log j
       set status = 'dead_letter',
           error_kind = 'stuck_exhausted',
           error_message = 'Stuck running job exceeded max attempts',
           finished_at = now()
      from stuck s
     where j.id = s.id
       and s.attempts >= s.max_attempts
     returning j.id
  )
  select (select count(*)::bigint from r), (select count(*)::bigint from d)
    into v_rescued, v_dead;

  return query select coalesce(v_rescued, 0), coalesce(v_dead, 0);
end;
$$;

revoke all on function public.peaker_jobs_rescue_stuck(integer) from public;
revoke all on function public.peaker_jobs_rescue_stuck(integer) from anon;
revoke all on function public.peaker_jobs_rescue_stuck(integer) from authenticated;

comment on function public.peaker_jobs_rescue_stuck(integer) is
  'Faz 13.1 — Requeue stuck running jobs or finalize dead_letter if attempts >= max_attempts.';

-- 5) Org-scoped purge of completed terminal jobs (retention-safe manual admin).
create or replace function public.peaker_jobs_purge_completed_for_org(
  p_organization_id uuid,
  p_older_than_days integer default 30
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(coalesce(p_older_than_days, 30), 7);
  v_deleted bigint;
begin
  delete from public.peaker_jobs_log
   where organization_id = p_organization_id
     and status in ('succeeded', 'cancelled', 'duplicate')
     and finished_at is not null
     and finished_at < now() - (interval '1 day' * v_days);
  get diagnostics v_deleted = row_count;
  return coalesce(v_deleted, 0);
end;
$$;

revoke all on function public.peaker_jobs_purge_completed_for_org(uuid, integer) from public;
revoke all on function public.peaker_jobs_purge_completed_for_org(uuid, integer) from anon;
revoke all on function public.peaker_jobs_purge_completed_for_org(uuid, integer) from authenticated;

-- 6) Rate limit table cleanup — daily cron (low traffic slot).
do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'peaker_rate_limit_cleanup';
    perform cron.schedule(
      'peaker_rate_limit_cleanup',
      '20 4 * * *',
      $cron$
        select public.peaker_rate_limit_cleanup(48);
      $cron$
    );
    raise notice 'peaker_rate_limit_cleanup scheduled (daily 04:20 UTC)';
  else
    raise notice 'pg_cron yok — peaker_rate_limit_cleanup atlandı';
  end if;
end$$;
