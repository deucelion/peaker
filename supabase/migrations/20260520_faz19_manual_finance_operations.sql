-- FAZ 19 — Manuel tahsilat operasyonları: finans notları, alacak hatırlatma, PLP iptal desteği.
-- Non-destructive.

-- 1) Finans / tahsilat görüşme notları
create table if not exists public.finance_contact_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid null references public.private_lesson_packages(id) on delete set null,
  note text not null,
  contact_method text not null default 'other'
    check (contact_method in ('phone', 'whatsapp', 'in_person', 'other')),
  follow_up_date date null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by uuid null references public.profiles(id) on delete set null
);

create index if not exists idx_finance_contact_notes_org_created
  on public.finance_contact_notes (organization_id, created_at desc);
create index if not exists idx_finance_contact_notes_athlete
  on public.finance_contact_notes (athlete_id, created_at desc);
create index if not exists idx_finance_contact_notes_package
  on public.finance_contact_notes (package_id, created_at desc)
  where package_id is not null;

alter table public.finance_contact_notes enable row level security;

drop policy if exists finance_contact_notes_select on public.finance_contact_notes;
create policy finance_contact_notes_select on public.finance_contact_notes
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and (
          me.role = 'super_admin'
          or (me.role = 'admin' and me.organization_id = finance_contact_notes.organization_id)
          or (me.role = 'coach' and me.organization_id = finance_contact_notes.organization_id)
          or (me.role = 'sporcu' and me.id = finance_contact_notes.athlete_id)
        )
    )
  );

drop policy if exists finance_contact_notes_insert on public.finance_contact_notes;
create policy finance_contact_notes_insert on public.finance_contact_notes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'coach', 'super_admin')
        and (
          me.role = 'super_admin'
          or me.organization_id = finance_contact_notes.organization_id
        )
    )
  );

drop policy if exists finance_contact_notes_update on public.finance_contact_notes;
create policy finance_contact_notes_update on public.finance_contact_notes
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'super_admin')
        and (
          me.role = 'super_admin'
          or me.organization_id = finance_contact_notes.organization_id
        )
    )
  );

-- 2) private_lesson_payments — iptal (silme yok)
alter table public.private_lesson_payments
  add column if not exists voided_at timestamptz null,
  add column if not exists voided_by uuid null references public.profiles(id) on delete set null,
  add column if not exists void_reason text null;

create index if not exists idx_plp_active_package
  on public.private_lesson_payments (package_id, paid_at desc)
  where voided_at is null;

-- 3) Alacak hatırlatma — aynı paket / tür / gün bir kez
create table if not exists public.receivable_reminder_sent (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  package_id uuid not null references public.private_lesson_packages(id) on delete cascade,
  alert_kind text not null check (alert_kind in ('due_soon', 'overdue')),
  sent_on date not null,
  primary key (organization_id, package_id, alert_kind, sent_on)
);

create index if not exists idx_receivable_reminder_sent_org_day
  on public.receivable_reminder_sent (organization_id, sent_on desc);

create table if not exists public.peaker_receivable_sweep_state (
  id smallint primary key default 1 check (id = 1),
  last_run_on date null
);

insert into public.peaker_receivable_sweep_state (id, last_run_on)
values (1, null)
on conflict (id) do nothing;

-- 4) Atomik: defter satırı iptali
create or replace function public.private_lesson_void_ledger_payment_atomic(
  p_plp_id uuid,
  p_organization_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns table(new_amount_paid numeric, new_payment_status text, out_package_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.private_lesson_payments%rowtype;
  v_pkg public.private_lesson_packages%rowtype;
  v_next numeric(12,2);
  v_st text;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Iptal nedeni zorunlu';
  end if;

  select * into v_row
  from public.private_lesson_payments
  where id = p_plp_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Tahsilat kaydi bulunamadi';
  end if;

  if v_row.voided_at is not null then
    raise exception 'Kayit zaten iptal edilmis';
  end if;

  select * into v_pkg
  from public.private_lesson_packages
  where id = v_row.package_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Paket bulunamadi';
  end if;

  v_next := round((coalesce(v_pkg.amount_paid, 0) - v_row.amount)::numeric, 2);
  if v_next < 0 then
    v_next := 0;
  end if;

  v_st := case
    when v_next <= 0 then 'unpaid'
    when v_next >= coalesce(v_pkg.total_price, 0) then 'paid'
    else 'partial'
  end;

  update public.private_lesson_payments
  set voided_at = now(),
      voided_by = p_actor_id,
      void_reason = left(trim(p_reason), 2000)
  where id = v_row.id;

  update public.private_lesson_packages
  set amount_paid = v_next,
      payment_status = v_st,
      updated_at = now()
  where id = v_pkg.id;

  return query select v_next, v_st, v_pkg.id;
end;
$$;

grant execute on function public.private_lesson_void_ledger_payment_atomic(
  uuid, uuid, uuid, text
) to service_role;

comment on function public.private_lesson_void_ledger_payment_atomic is
  'Faz 19 — Paket defter satırı iptali; amount_paid güncellenir.';
