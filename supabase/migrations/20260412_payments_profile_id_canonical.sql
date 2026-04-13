-- ============================================================================
-- PAYMENTS CANONICAL MIGRATION
-- Hedef şema:
-- id uuid pk
-- organization_id uuid not null -> organizations(id)
-- profile_id uuid not null -> profiles(id)
-- amount numeric(12,2) not null
-- payment_type text not null check ('aylik','paket')
-- due_date date
-- payment_date timestamptz
-- status text not null check ('bekliyor','odendi')
-- total_sessions integer
-- remaining_sessions integer
-- description text
-- month_name text
-- year_int integer
-- created_at timestamptz not null default now()
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'payments'
  ) then
    create table public.payments (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations (id) on delete cascade,
      profile_id uuid not null references public.profiles (id) on delete cascade,
      amount numeric(12, 2) not null,
      payment_type text not null default 'aylik',
      due_date date,
      payment_date timestamptz,
      status text not null default 'bekliyor',
      total_sessions integer,
      remaining_sessions integer,
      description text,
      month_name text,
      year_int integer,
      created_at timestamptz not null default now(),
      constraint payments_payment_type_check check (payment_type in ('aylik', 'paket')),
      constraint payments_status_check check (status in ('bekliyor', 'odendi'))
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Eksik kolonları ekle
-- ----------------------------------------------------------------------------
alter table public.payments
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

alter table public.payments
  add column if not exists profile_id uuid references public.profiles (id) on delete cascade;

alter table public.payments
  add column if not exists amount numeric(12, 2);

alter table public.payments
  add column if not exists payment_type text;

alter table public.payments
  add column if not exists due_date date;

alter table public.payments
  add column if not exists payment_date timestamptz;

alter table public.payments
  add column if not exists status text;

alter table public.payments
  add column if not exists total_sessions integer;

alter table public.payments
  add column if not exists remaining_sessions integer;

alter table public.payments
  add column if not exists description text;

alter table public.payments
  add column if not exists month_name text;

alter table public.payments
  add column if not exists year_int integer;

alter table public.payments
  add column if not exists created_at timestamptz default now();

-- ----------------------------------------------------------------------------
-- profile_id backfill
-- 1) user_id varsa ve profiles.id ile eşleşiyorsa oradan doldur
-- 2) athlete_id varsa oradan doldur
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'user_id'
  ) then
    update public.payments p
    set profile_id = p.user_id
    where p.profile_id is null
      and p.user_id is not null
      and exists (
        select 1
        from public.profiles pr
        where pr.id = p.user_id
      );
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'athlete_id'
  ) then
    update public.payments p
    set profile_id = p.athlete_id
    where p.profile_id is null
      and p.athlete_id is not null
      and exists (
        select 1
        from public.profiles pr
        where pr.id = p.athlete_id
      );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- organization_id backfill
-- profile_id çözülmüşse profiles.organization_id üzerinden doldur
-- ----------------------------------------------------------------------------
update public.payments p
set organization_id = pr.organization_id
from public.profiles pr
where p.profile_id = pr.id
  and p.organization_id is null;

-- ----------------------------------------------------------------------------
-- amount backfill / normalize
-- ----------------------------------------------------------------------------
update public.payments
set amount = 0
where amount is null;

-- ----------------------------------------------------------------------------
-- payment_type backfill
-- ----------------------------------------------------------------------------
update public.payments
set payment_type = case
  when payment_type is not null then payment_type
  when coalesce(total_sessions, 0) > 0 then 'paket'
  when coalesce(remaining_sessions, 0) > 0 then 'paket'
  else 'aylik'
end
where payment_type is null;

update public.payments
set payment_type = 'aylik'
where payment_type not in ('aylik', 'paket')
   or payment_type is null;

-- ----------------------------------------------------------------------------
-- status backfill
-- Eski is_paid varsa ondan üret
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'is_paid'
  ) then
    update public.payments
    set status = case
      when is_paid = true then 'odendi'
      else 'bekliyor'
    end
    where status is null;
  end if;
end $$;

update public.payments
set status = 'bekliyor'
where status is null;

update public.payments
set status = 'bekliyor'
where status not in ('bekliyor', 'odendi');

-- ----------------------------------------------------------------------------
-- payment_date backfill
-- ----------------------------------------------------------------------------
update public.payments
set payment_date = created_at
where status = 'odendi'
  and payment_date is null
  and created_at is not null;

-- ----------------------------------------------------------------------------
-- Session alanları sanity
-- ----------------------------------------------------------------------------
update public.payments
set total_sessions = null
where total_sessions is not null
  and total_sessions < 0;

update public.payments
set remaining_sessions = null
where remaining_sessions is not null
  and remaining_sessions < 0;

update public.payments
set remaining_sessions = total_sessions
where payment_type = 'paket'
  and total_sessions is not null
  and remaining_sessions is null;

-- ----------------------------------------------------------------------------
-- Eski kolonları kaldır
-- ----------------------------------------------------------------------------
alter table public.payments drop column if exists user_id;

alter table public.payments drop column if exists athlete_id;

alter table public.payments drop column if exists is_paid;

-- ----------------------------------------------------------------------------
-- Null kalan bozuk kayıtları temizle
-- ----------------------------------------------------------------------------
delete from public.payments
where profile_id is null
   or organization_id is null;

-- ----------------------------------------------------------------------------
-- NOT NULL zorunlulukları
-- ----------------------------------------------------------------------------
alter table public.payments
  alter column profile_id set not null;

alter table public.payments
  alter column organization_id set not null;

alter table public.payments
  alter column amount set not null;

alter table public.payments
  alter column payment_type set not null;

alter table public.payments
  alter column status set not null;

alter table public.payments
  alter column created_at set not null;

-- ----------------------------------------------------------------------------
-- Varsayılanlar
-- ----------------------------------------------------------------------------
alter table public.payments
  alter column payment_type set default 'aylik';

alter table public.payments
  alter column status set default 'bekliyor';

alter table public.payments
  alter column created_at set default now();

-- ----------------------------------------------------------------------------
-- Constraint'leri yeniden kur
-- ----------------------------------------------------------------------------
alter table public.payments
  drop constraint if exists payments_payment_type_check;

alter table public.payments
  add constraint payments_payment_type_check
  check (payment_type in ('aylik', 'paket'));

alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('bekliyor', 'odendi'));

-- ----------------------------------------------------------------------------
-- İndeksler
-- ----------------------------------------------------------------------------
create index if not exists idx_payments_org_profile
  on public.payments (organization_id, profile_id);

create index if not exists idx_payments_org
  on public.payments (organization_id);

create index if not exists idx_payments_profile
  on public.payments (profile_id);

create index if not exists idx_payments_status
  on public.payments (status);

create index if not exists idx_payments_due_date
  on public.payments (due_date);

-- ----------------------------------------------------------------------------
-- Yorum
-- ----------------------------------------------------------------------------
comment on table public.payments is 'Aidat ve ödeme kayıtları; tek sahip kolonu profile_id (public.profiles.id).';

comment on column public.payments.profile_id is 'Ödeme sahibi profil (public.profiles.id).';

comment on column public.payments.payment_type is 'Odeme tipi: aylik veya paket.';

comment on column public.payments.status is 'Odeme durumu: bekliyor veya odendi.';
