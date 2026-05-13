-- ============================================================================
-- payments: full canonical schema sync (idempotent)
--
-- Some prior migrations (notably 20260422_payments_scope_kind_soft_delete and
-- 20260506_payments_dynamic_extra_kinds) may not have been applied to all
-- environments. Application code in
--   src/lib/actions/accountingFinanceActions.ts
--   src/lib/actions/financeActions.ts
--   src/lib/privateLessons/packagePaymentSync.ts
-- now requires every column listed below. Missing columns trigger a long
-- compatibility-fallback chain and KPIs report zero (see logs: 42703).
--
-- This migration is safe to run multiple times: every change uses
-- "if not exists" / "drop constraint if exists" / idempotent guards.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Columns
-- ----------------------------------------------------------------------------
alter table public.payments
  add column if not exists payment_scope  text,
  add column if not exists payment_kind   text,
  add column if not exists display_name   text,
  add column if not exists metadata_json  jsonb,
  add column if not exists deleted_at     timestamptz,
  add column if not exists deleted_by     uuid,
  add column if not exists delete_reason  text,
  add column if not exists paid_at        timestamptz,
  add column if not exists package_id     uuid;

-- ----------------------------------------------------------------------------
-- 2) Backfill payment_scope / payment_kind from legacy payment_type
-- ----------------------------------------------------------------------------
update public.payments
set payment_scope = case
  when payment_type = 'paket' then 'private_lesson'
  else 'membership'
end
where payment_scope is null;

update public.payments
set payment_kind = case
  when payment_type = 'paket' then 'private_lesson_package'
  else 'monthly_membership'
end
where payment_kind is null;

-- ----------------------------------------------------------------------------
-- 3) Backfill paid_at from payment_date / created_at
-- ----------------------------------------------------------------------------
update public.payments
set paid_at = coalesce(payment_date, created_at)
where paid_at is null;

-- ----------------------------------------------------------------------------
-- 4) Defaults + NOT NULL on scope/kind
-- ----------------------------------------------------------------------------
alter table public.payments
  alter column payment_scope set default 'membership',
  alter column payment_kind  set default 'monthly_membership';

alter table public.payments
  alter column payment_scope set not null,
  alter column payment_kind  set not null;

-- ----------------------------------------------------------------------------
-- 5) Constraints
-- ----------------------------------------------------------------------------
alter table public.payments
  drop constraint if exists payments_payment_scope_check;

alter table public.payments
  add constraint payments_payment_scope_check
  check (payment_scope in ('membership', 'private_lesson', 'extra_charge'));

alter table public.payments
  drop constraint if exists payments_payment_kind_check;

-- 20260506 widened payment_kind to allow dynamic extra-charge kinds.
alter table public.payments
  add constraint payments_payment_kind_check
  check (
    payment_kind in (
      'monthly_membership',
      'private_lesson_package',
      'license',
      'event',
      'equipment',
      'manual_other'
    )
    or payment_kind ~ '^[a-z0-9_]{2,80}$'
  );

-- ----------------------------------------------------------------------------
-- 6) Foreign keys (deleted_by, package_id)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_deleted_by_fkey'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_deleted_by_fkey
      foreign key (deleted_by)
      references public.profiles (id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
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

-- ----------------------------------------------------------------------------
-- 7) Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_payments_deleted_at
  on public.payments (deleted_at);

create index if not exists idx_payments_scope_kind
  on public.payments (organization_id, payment_scope, payment_kind);

create index if not exists idx_payments_paid_at
  on public.payments (paid_at desc);

create index if not exists idx_payments_org_paid_at
  on public.payments (organization_id, paid_at desc);

create index if not exists idx_payments_package_id
  on public.payments (package_id);

-- ----------------------------------------------------------------------------
-- 8) Comments
-- ----------------------------------------------------------------------------
comment on column public.payments.payment_scope is
  'Tahsilat kapsamı: membership | private_lesson | extra_charge.';
comment on column public.payments.payment_kind is
  'Tahsilat türü; standart değerler veya snake_case dinamik anahtar (özel tahsilat).';
comment on column public.payments.display_name is
  'Listelerde gösterilen başlık (ör. "Mayıs aidatı", "Lisans yenileme").';
comment on column public.payments.metadata_json is
  'Serbest meta veri: kanal, kaynak, ek alanlar.';
comment on column public.payments.deleted_at is
  'Soft delete zamanı; null ise satır aktiftir.';
comment on column public.payments.deleted_by is
  'Soft delete işlemini yapan profile.id.';
comment on column public.payments.delete_reason is
  'Soft delete sebebi (operasyonel iz için).';
comment on column public.payments.paid_at is
  'Tahsilatın gerçekleştiği UTC anı; eski kayıtlarda payment_date / created_at ile doldurulmuştur.';
comment on column public.payments.package_id is
  'Tahsilat bir özel ders paketine ait ise private_lesson_packages.id; aksi halde NULL.';

-- ----------------------------------------------------------------------------
-- 9) Tell PostgREST to reload its schema cache
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
