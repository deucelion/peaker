create table if not exists public.private_lesson_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid null references public.profiles(id) on delete set null,
  package_type text not null,
  package_name text not null,
  total_lessons integer not null check (total_lessons > 0),
  used_lessons integer not null default 0 check (used_lessons >= 0),
  remaining_lessons integer not null check (remaining_lessons >= 0),
  total_price numeric(12,2) not null default 0 check (total_price >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  is_active boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (used_lessons <= total_lessons),
  check (remaining_lessons = total_lessons - used_lessons)
);

create index if not exists idx_private_lesson_packages_org_athlete
  on public.private_lesson_packages (organization_id, athlete_id, created_at desc);

create index if not exists idx_private_lesson_packages_org_coach
  on public.private_lesson_packages (organization_id, coach_id, created_at desc);

create table if not exists public.private_lesson_usage (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.private_lesson_packages(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid null references public.profiles(id) on delete set null,
  used_at timestamptz not null default now(),
  note text null
);

create index if not exists idx_private_lesson_usage_package_used_at
  on public.private_lesson_usage (package_id, used_at desc);

create index if not exists idx_private_lesson_usage_athlete
  on public.private_lesson_usage (athlete_id, used_at desc);

alter table public.private_lesson_packages enable row level security;
alter table public.private_lesson_usage enable row level security;

drop policy if exists private_lesson_packages_select_policy on public.private_lesson_packages;
create policy private_lesson_packages_select_policy on public.private_lesson_packages
for select to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = private_lesson_packages.organization_id)
        or (me.role = 'coach' and me.organization_id = private_lesson_packages.organization_id)
        or (me.role = 'sporcu' and me.id = private_lesson_packages.athlete_id)
      )
  )
);

drop policy if exists private_lesson_packages_insert_policy on public.private_lesson_packages;
create policy private_lesson_packages_insert_policy on public.private_lesson_packages
for insert to authenticated
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = private_lesson_packages.organization_id)
        or (me.role = 'coach' and me.organization_id = private_lesson_packages.organization_id)
      )
  )
);

drop policy if exists private_lesson_packages_update_policy on public.private_lesson_packages;
create policy private_lesson_packages_update_policy on public.private_lesson_packages
for update to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = private_lesson_packages.organization_id)
        or (me.role = 'coach' and me.organization_id = private_lesson_packages.organization_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = private_lesson_packages.organization_id)
        or (me.role = 'coach' and me.organization_id = private_lesson_packages.organization_id)
      )
  )
);

drop policy if exists private_lesson_usage_select_policy on public.private_lesson_usage;
create policy private_lesson_usage_select_policy on public.private_lesson_usage
for select to authenticated
using (
  exists (
    select 1
    from public.profiles me
    join public.private_lesson_packages pkg on pkg.id = private_lesson_usage.package_id
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = pkg.organization_id)
        or (me.role = 'coach' and me.organization_id = pkg.organization_id)
        or (me.role = 'sporcu' and me.id = private_lesson_usage.athlete_id)
      )
  )
);

drop policy if exists private_lesson_usage_insert_policy on public.private_lesson_usage;
create policy private_lesson_usage_insert_policy on public.private_lesson_usage
for insert to authenticated
with check (
  exists (
    select 1
    from public.profiles me
    join public.private_lesson_packages pkg on pkg.id = private_lesson_usage.package_id
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = pkg.organization_id)
        or (me.role = 'coach' and me.organization_id = pkg.organization_id)
      )
  )
);

create or replace function public.private_lesson_packages_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists private_lesson_packages_set_updated_at on public.private_lesson_packages;
create trigger private_lesson_packages_set_updated_at
before update on public.private_lesson_packages
for each row execute function public.private_lesson_packages_set_updated_at();
