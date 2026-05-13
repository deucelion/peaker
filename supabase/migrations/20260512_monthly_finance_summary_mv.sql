-- Faz 10.3 — `monthly_finance_summary` materialized view.
--
-- Hedef:
--   Muhasebe dashboard'unun ay bazlı toplam tahsilat / vade / overdue
--   metriklerini önceden hesaplanmış olarak sağlamak. Production'da
--   100k+ payment satırında live query 1-2 saniye sürebilir; MV ile
--   <50ms.
--
-- Tenant isolation:
--   organization_id kolonu MV'de korunur. Service-role read için RLS
--   aşılır; uygulamada bu MV'yi okuyan tek yer admin/super-admin
--   operasyon paneli olacak (Faz 10.6).
--
-- Backward-compatible:
--   - Mevcut `loadAccountingFinanceDashboard` query'leri AYNI tablo
--     (`payments`) üzerinden çalışmaya devam eder. MV opsiyonel.
--   - Sadece operasyon paneli (Faz 10.6) bu MV'yi tüketir.
--
-- Refresh:
--   `pg_cron` job'u günlük 04:00 UTC'de `refresh materialized view
--   concurrently` çağırır. Bu migration ayrı bir cron job ekler
--   (`peaker_mv_monthly_finance_summary`).
--
-- Rollback:
--   `20260512_monthly_finance_summary_mv_rollback.sql` ile drop edilir.

-- 1) MV oluştur (idempotent: yoksa).
create materialized view if not exists public.monthly_finance_summary as
select
  p.organization_id,
  to_char(coalesce(p.payment_date::timestamptz, p.due_date::timestamptz, now()), 'YYYY-MM') as month_key,
  count(*) as payment_count,
  sum(case when p.status = 'odendi' then p.amount else 0 end)::numeric(14,2) as collected_amount,
  sum(case when p.status = 'bekliyor' then p.amount else 0 end)::numeric(14,2) as pending_amount,
  count(*) filter (where p.status = 'bekliyor' and p.due_date < current_date) as overdue_count,
  max(coalesce(p.payment_date, p.due_date)) as last_activity_date,
  -- Faz 10.6 paneli için: son refresh anına işaret eden generated kolon.
  now() as refreshed_at
from public.payments p
where p.deleted_at is null
  and p.organization_id is not null
group by 1, 2;

-- 2) Unique index (REFRESH CONCURRENTLY için zorunlu).
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'monthly_finance_summary'
      and indexname = 'monthly_finance_summary_uniq'
  ) then
    create unique index monthly_finance_summary_uniq
      on public.monthly_finance_summary (organization_id, month_key);
  end if;
end$$;

-- 3) Lookup index (org + last_activity desc).
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'monthly_finance_summary'
      and indexname = 'monthly_finance_summary_org_recent_idx'
  ) then
    create index monthly_finance_summary_org_recent_idx
      on public.monthly_finance_summary (organization_id, last_activity_date desc);
  end if;
end$$;

-- 4) Erişim yetkisi: yalnızca service_role + postgres okuyabilir.
--    RLS MV üstünde çalışmaz; sadece DB rolünün GRANT'i ile yönetilir.
revoke all on public.monthly_finance_summary from public;
revoke all on public.monthly_finance_summary from anon;
revoke all on public.monthly_finance_summary from authenticated;
-- service_role her zaman erişebilir (Supabase default).

-- 5) pg_cron job — günlük 04:00 UTC refresh.
do $$
declare
  has_cron boolean := false;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  if has_cron then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'peaker_mv_monthly_finance_summary';
    perform cron.schedule(
      'peaker_mv_monthly_finance_summary',
      '0 4 * * *',
      $cron$
        refresh materialized view concurrently public.monthly_finance_summary;
      $cron$
    );
    raise notice 'peaker_mv_monthly_finance_summary scheduled (daily 04:00 UTC)';
  else
    raise notice 'pg_cron yok — MV refresh cron atlandı; manuel refresh kullanılır';
  end if;
end$$;

-- 6) Manual refresh helper (admin paneli / smoke testlerinde çağrılabilir).
--    SECURITY DEFINER ile service_role yetkisi gerektirmeden çağrılabilir;
--    fakat RPC'ye anon/authenticated EXECUTE verilmez.
create or replace function public.refresh_monthly_finance_summary()
returns table(refreshed_at timestamptz, row_count bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count bigint;
begin
  refresh materialized view concurrently public.monthly_finance_summary;
  select count(*) into v_count from public.monthly_finance_summary;
  return query select now() as refreshed_at, v_count;
end;
$$;

revoke all on function public.refresh_monthly_finance_summary() from public;
revoke all on function public.refresh_monthly_finance_summary() from anon;
revoke all on function public.refresh_monthly_finance_summary() from authenticated;
-- service_role var olarak erişebilir.

comment on materialized view public.monthly_finance_summary is
  'Faz 10.3 — Aylık finansal özet aggregation. organization_id+month_key unique. Daily refresh via pg_cron.';
