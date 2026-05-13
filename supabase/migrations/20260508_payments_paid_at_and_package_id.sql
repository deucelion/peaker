-- ============================================================================
-- payments: paid_at + package_id canonical columns
--
-- Application code (`src/lib/actions/accountingFinanceActions.ts`,
-- `src/lib/privateLessons/packagePaymentSync.ts`) writes and selects
-- `paid_at` and `package_id` on `public.payments`. The original canonical
-- migration (20260412) does not declare them. When they are missing, every
-- query falls back through `isPaymentsSchemaCompatibilityError` and Panel
-- KPIs show zero (see logs: 42703 column does not exist).
--
-- This migration adds both columns idempotently, backfills `paid_at`
-- from existing payment_date/created_at, registers a real foreign key
-- so PostgREST can embed the package, and reloads the schema cache.
-- ============================================================================

alter table public.payments
  add column if not exists paid_at timestamptz,
  add column if not exists package_id uuid;

-- Backfill paid_at: prefer historical payment_date, then created_at.
update public.payments
set paid_at = coalesce(payment_date, created_at)
where paid_at is null;

-- Foreign key for package_id; on delete keep payment row (set null) so
-- that paket silinse bile geçmiş muhasebe satırları kaybolmaz.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_package_id_fkey'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_package_id_fkey
      foreign key (package_id)
      references public.private_lesson_packages (id)
      on delete set null;
  end if;
end $$;

-- Hot indexes for date-range / per-package lookups.
create index if not exists idx_payments_paid_at
  on public.payments (paid_at desc);

create index if not exists idx_payments_org_paid_at
  on public.payments (organization_id, paid_at desc);

create index if not exists idx_payments_package_id
  on public.payments (package_id);

comment on column public.payments.paid_at is
  'Tahsilatın gerçekleştiği UTC anı. Eski kayıtlarda payment_date veya created_at değerine eşitlenir.';

comment on column public.payments.package_id is
  'Tahsilat bir özel ders paketine ait ise referans (private_lesson_packages.id). Aksi halde NULL.';

notify pgrst, 'reload schema';
