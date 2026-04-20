-- Production hardening diagnostics helper.
-- Read-only function used by system health checks.

create or replace function public.production_hardening_health()
returns table (
  onboarding_bundle_rpc_ready boolean,
  private_lesson_usage_atomic_rpc_ready boolean,
  private_lesson_payment_atomic_rpc_ready boolean,
  payments_decrement_atomic_rpc_ready boolean,
  payments_unique_due_index_ready boolean
)
language sql
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'create_athlete_onboarding_bundle'
    ) as onboarding_bundle_rpc_ready,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'private_lesson_apply_usage_atomic'
    ) as private_lesson_usage_atomic_rpc_ready,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'private_lesson_apply_payment_atomic'
    ) as private_lesson_payment_atomic_rpc_ready,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'payments_decrement_package_session_atomic'
    ) as payments_decrement_atomic_rpc_ready,
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname = 'uq_payments_org_profile_type_due'
    ) as payments_unique_due_index_ready;
$$;

grant execute on function public.production_hardening_health()
to authenticated, service_role;
