alter table if exists public.test_definitions
  add column if not exists sort_order integer not null default 0;

alter table if exists public.test_definitions
  add column if not exists value_type text not null default 'number';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'test_definitions'
      and constraint_name = 'test_definitions_value_type_check'
  ) then
    alter table public.test_definitions
      drop constraint test_definitions_value_type_check;
  end if;
end $$;

alter table if exists public.test_definitions
  add constraint test_definitions_value_type_check
  check (value_type in ('number', 'text'));

update public.test_definitions td
set sort_order = ordered.rn
from (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.test_definitions
) as ordered
where td.id = ordered.id
  and coalesce(td.sort_order, 0) = 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'test_definitions'
      and column_name = 'organization_id'
  ) then
    create index if not exists idx_test_definitions_org_sort
      on public.test_definitions (organization_id, sort_order);
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'test_definitions'
      and column_name = 'org_id'
  ) then
    create index if not exists idx_test_definitions_org_sort_legacy
      on public.test_definitions (org_id, sort_order);
  end if;
end $$;

alter table if exists public.athletic_results
  add column if not exists value_text text null;

create table if not exists public.athletic_result_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  test_date date not null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athletic_result_notes_unique_profile_day unique (profile_id, test_date)
);

create index if not exists idx_athletic_result_notes_org_day
  on public.athletic_result_notes (organization_id, test_date desc);
