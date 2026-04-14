create table if not exists public.private_lesson_payments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.private_lesson_packages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid null references public.profiles(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  note text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_private_lesson_payments_package_paid_at
  on public.private_lesson_payments (package_id, paid_at desc);

create index if not exists idx_private_lesson_payments_org
  on public.private_lesson_payments (organization_id, created_at desc);

create index if not exists idx_private_lesson_payments_athlete
  on public.private_lesson_payments (athlete_id, paid_at desc);

alter table public.private_lesson_payments enable row level security;

drop policy if exists private_lesson_payments_select_policy on public.private_lesson_payments;
create policy private_lesson_payments_select_policy on public.private_lesson_payments
for select to authenticated
using (
  exists (
    select 1
    from public.profiles me
    join public.private_lesson_packages pkg on pkg.id = private_lesson_payments.package_id
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = pkg.organization_id)
        or (me.role = 'coach' and me.organization_id = pkg.organization_id)
        or (me.role = 'sporcu' and me.id = private_lesson_payments.athlete_id)
      )
  )
);

drop policy if exists private_lesson_payments_insert_policy on public.private_lesson_payments;
create policy private_lesson_payments_insert_policy on public.private_lesson_payments
for insert to authenticated
with check (
  exists (
    select 1
    from public.profiles me
    join public.private_lesson_packages pkg on pkg.id = private_lesson_payments.package_id
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = pkg.organization_id)
        or (me.role = 'coach' and me.organization_id = pkg.organization_id)
      )
  )
);

-- Legacy backfill: existing amount_paid values appear in history once.
insert into public.private_lesson_payments (
  package_id,
  organization_id,
  athlete_id,
  coach_id,
  amount,
  paid_at,
  note,
  created_by,
  created_at
)
select
  pkg.id,
  pkg.organization_id,
  pkg.athlete_id,
  pkg.coach_id,
  pkg.amount_paid,
  coalesce(pkg.updated_at, pkg.created_at, now()),
  'Legacy payment snapshot',
  pkg.created_by,
  coalesce(pkg.updated_at, pkg.created_at, now())
from public.private_lesson_packages pkg
where pkg.amount_paid > 0
  and not exists (
    select 1
    from public.private_lesson_payments pay
    where pay.package_id = pkg.id
  );
