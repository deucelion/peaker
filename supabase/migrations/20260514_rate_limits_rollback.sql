-- Faz 12.3 — Rate limit table rollback.

drop function if exists public.peaker_rate_limit_cleanup(integer);
drop function if exists public.peaker_rate_limit_check(text, integer, integer);

drop policy if exists peaker_rate_limits_service on public.peaker_rate_limits;
drop index if exists public.peaker_rate_limits_updated_idx;
drop table if exists public.peaker_rate_limits;
