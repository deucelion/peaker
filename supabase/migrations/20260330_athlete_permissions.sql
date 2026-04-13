create table if not exists public.athlete_permissions (
  athlete_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  can_view_morning_report boolean not null default true,
  can_view_programs boolean not null default true,
  can_view_calendar boolean not null default true,
  can_view_notifications boolean not null default true,
  can_view_rpe_entry boolean not null default true,
  can_view_development_profile boolean not null default true,
  can_view_financial_status boolean not null default true,
  can_view_performance_metrics boolean not null default true,
  can_view_wellness_metrics boolean not null default true,
  can_view_skill_radar boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.athlete_permissions (athlete_id, organization_id)
select p.id, p.organization_id
from public.profiles p
where p.role = 'sporcu'
  and p.organization_id is not null
on conflict (athlete_id) do nothing;

create index if not exists idx_athlete_permissions_org on public.athlete_permissions (organization_id, athlete_id);

alter table public.athlete_permissions enable row level security;

drop policy if exists athlete_permissions_select_policy on public.athlete_permissions;
create policy athlete_permissions_select_policy on public.athlete_permissions
for select
using (
  organization_id = (nullif(auth.jwt() ->> 'organization_id', '')::uuid)
  and (
    coalesce(auth.jwt() ->> 'role', '') in ('admin', 'coach')
    or athlete_id = auth.uid()
  )
);
