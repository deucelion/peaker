-- Faz 18 — Paket lifecycle, taksit takibi ve paket event geçmişi (non-destructive).

alter table public.private_lesson_packages
  add column if not exists lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'paused', 'completed', 'cancelled', 'refunded'));

alter table public.private_lesson_packages
  add column if not exists installment_count integer null check (installment_count is null or installment_count > 0);

alter table public.private_lesson_packages
  add column if not exists installment_interval_days integer null
    check (installment_interval_days is null or installment_interval_days > 0);

alter table public.private_lesson_packages
  add column if not exists next_payment_due_at timestamptz null;

create index if not exists idx_private_lesson_packages_lifecycle
  on public.private_lesson_packages (organization_id, lifecycle_status);

comment on column public.private_lesson_packages.lifecycle_status is
  'Faz 18: active | paused | completed | cancelled | refunded';

-- Mevcut satırları is_active + ders sayılarından türet (tek seferlik backfill).
update public.private_lesson_packages p
set lifecycle_status = case
  when p.remaining_lessons <= 0 and coalesce(p.used_lessons, 0) > 0 then 'completed'
  when not p.is_active and p.remaining_lessons > 0 then 'paused'
  when not p.is_active then 'cancelled'
  else 'active'
end;

create table if not exists public.private_lesson_package_events (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.private_lesson_packages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid null references public.profiles(id) on delete set null,
  event_type text not null,
  title text not null,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pl_package_events_package_created
  on public.private_lesson_package_events (package_id, created_at desc);

create index if not exists idx_pl_package_events_org_created
  on public.private_lesson_package_events (organization_id, created_at desc);

alter table public.private_lesson_package_events enable row level security;

drop policy if exists private_lesson_package_events_select_policy on public.private_lesson_package_events;
create policy private_lesson_package_events_select_policy on public.private_lesson_package_events
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and (
          me.role = 'super_admin'
          or (me.role = 'admin' and me.organization_id = private_lesson_package_events.organization_id)
          or (me.role = 'coach' and me.organization_id = private_lesson_package_events.organization_id)
          or (
            me.role = 'sporcu'
            and exists (
              select 1 from public.private_lesson_packages pkg
              where pkg.id = private_lesson_package_events.package_id
                and pkg.athlete_id = me.id
            )
          )
        )
    )
  );

drop policy if exists private_lesson_package_events_insert_policy on public.private_lesson_package_events;
create policy private_lesson_package_events_insert_policy on public.private_lesson_package_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.role in ('admin', 'coach', 'super_admin')
        and (
          me.role = 'super_admin'
          or me.organization_id = private_lesson_package_events.organization_id
        )
    )
  );
