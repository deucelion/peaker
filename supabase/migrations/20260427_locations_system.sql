create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  created_at timestamptz not null default now(),
  constraint locations_name_len check (char_length(name) between 2 and 80),
  constraint locations_color_hex check (color ~* '^#[0-9a-f]{6}$')
);

create unique index if not exists locations_org_name_unique
  on public.locations (organization_id, lower(name));

create index if not exists idx_locations_org_created
  on public.locations (organization_id, created_at desc);

alter table public.locations enable row level security;

drop policy if exists locations_select_org_scope on public.locations;
create policy locations_select_org_scope
  on public.locations
  for select
  using (organization_id::text = auth.jwt() ->> 'organization_id');
