-- Faz 6: Production operations - retention helpers for notifications and audit logs.
-- Idempotent. Safe to run multiple times.

-- 1) Read notifications older than 90 days can be safely cleaned up.
create or replace function public.cleanup_read_notifications(retention_days integer default 90)
returns table (deleted_count integer) as $$
declare
  cutoff timestamptz;
  removed integer;
begin
  if retention_days is null or retention_days < 30 then
    raise exception 'retention_days must be >= 30';
  end if;
  cutoff := now() - make_interval(days => retention_days);
  with del as (
    delete from public.notifications
    where read = true
      and created_at < cutoff
    returning 1
  )
  select count(*)::int into removed from del;
  deleted_count := coalesce(removed, 0);
  return next;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.cleanup_read_notifications(integer) from public;
grant execute on function public.cleanup_read_notifications(integer) to authenticated, service_role;

-- 2) Audit logs older than 365 days can be archived/cleaned up.
-- This implementation is delete-only; archival to cold storage can be layered on top later.
create or replace function public.cleanup_audit_logs(retention_days integer default 365)
returns table (deleted_count integer) as $$
declare
  cutoff timestamptz;
  removed integer;
begin
  if retention_days is null or retention_days < 90 then
    raise exception 'retention_days must be >= 90';
  end if;
  cutoff := now() - make_interval(days => retention_days);
  with del as (
    delete from public.audit_logs
    where created_at < cutoff
    returning 1
  )
  select count(*)::int into removed from del;
  deleted_count := coalesce(removed, 0);
  return next;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.cleanup_audit_logs(integer) from public;
grant execute on function public.cleanup_audit_logs(integer) to service_role;

-- Helper indexes for retention sweeps.
create index if not exists idx_notifications_read_created_at
  on public.notifications (read, created_at)
  where read = true;
