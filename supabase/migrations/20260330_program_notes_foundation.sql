-- Program and coach note assignments for athletes.
create table if not exists public.athlete_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  note text null,
  week_start date null,
  pdf_url text null,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('program-assets', 'program-assets', true)
on conflict (id) do nothing;

create index if not exists idx_athlete_programs_org_athlete_created
  on public.athlete_programs (organization_id, athlete_id, created_at desc);

create index if not exists idx_athlete_programs_org_coach_created
  on public.athlete_programs (organization_id, coach_id, created_at desc);

alter table public.athlete_programs enable row level security;

drop policy if exists athlete_programs_select_policy on public.athlete_programs;
create policy athlete_programs_select_policy on public.athlete_programs
for select
using (
  organization_id = (nullif(auth.jwt() ->> 'organization_id', '')::uuid)
  and (
    coalesce(auth.jwt() ->> 'role', '') in ('admin', 'coach')
    or athlete_id = auth.uid()
  )
);

drop policy if exists athlete_programs_insert_policy on public.athlete_programs;
create policy athlete_programs_insert_policy on public.athlete_programs
for insert
with check (
  organization_id = (nullif(auth.jwt() ->> 'organization_id', '')::uuid)
  and coalesce(auth.jwt() ->> 'role', '') in ('admin', 'coach')
);
