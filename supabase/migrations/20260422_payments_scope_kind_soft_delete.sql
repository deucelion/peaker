-- payments domain extension + soft delete support

alter table public.payments
  add column if not exists payment_scope text,
  add column if not exists payment_kind text,
  add column if not exists display_name text,
  add column if not exists metadata_json jsonb,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists delete_reason text;

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
  drop constraint if exists payments_payment_scope_check;

alter table public.payments
  add constraint payments_payment_scope_check
  check (payment_scope in ('membership', 'private_lesson', 'extra_charge'));

alter table public.payments
  drop constraint if exists payments_payment_kind_check;

alter table public.payments
  add constraint payments_payment_kind_check
  check (payment_kind in ('monthly_membership', 'private_lesson_package', 'license', 'event', 'equipment', 'manual_other'));

create index if not exists idx_payments_deleted_at on public.payments (deleted_at);
create index if not exists idx_payments_scope_kind on public.payments (organization_id, payment_scope, payment_kind);
