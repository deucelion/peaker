create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint teams_name_len check (char_length(name) between 2 and 60)
);

alter table public.teams add column if not exists organization_id uuid;
alter table public.teams add column if not exists name text;
alter table public.teams add column if not exists created_by uuid;
alter table public.teams add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'teams_organization_id_fkey'
  ) then
    alter table public.teams
      add constraint teams_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'teams_created_by_fkey'
  ) then
    alter table public.teams
      add constraint teams_created_by_fkey
      foreign key (created_by) references public.profiles(id) on delete set null;
  end if;
end $$;

create unique index if not exists teams_org_name_unique
  on public.teams (organization_id, lower(name));

alter table public.teams enable row level security;

drop policy if exists "teams_select_org_scope" on public.teams;

create policy "teams_select_org_scope"
  on public.teams
  for select
  using (organization_id::text = auth.jwt() ->> 'organization_id');

