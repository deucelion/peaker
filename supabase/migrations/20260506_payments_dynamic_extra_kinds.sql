-- Allow dynamic payment_kind values for extra charges.
-- Idempotent: if 20260422 was never applied, payment_kind / payment_scope may be missing — add and backfill first.

alter table public.payments
  add column if not exists payment_scope text,
  add column if not exists payment_kind text;

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

alter table public.payments
  alter column payment_scope set default 'membership',
  alter column payment_kind set default 'monthly_membership';

alter table public.payments
  alter column payment_scope set not null,
  alter column payment_kind set not null;

alter table public.payments
  drop constraint if exists payments_payment_kind_check;

alter table public.payments
  add constraint payments_payment_kind_check
  check (
    payment_kind in ('monthly_membership', 'private_lesson_package')
    or payment_kind ~ '^[a-z0-9_]{2,80}$'
  );

create index if not exists idx_payments_scope_kind on public.payments (organization_id, payment_scope, payment_kind);
