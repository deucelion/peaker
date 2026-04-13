create table if not exists public.coach_permissions (
  coach_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  can_create_lessons boolean not null default true,
  can_edit_lessons boolean not null default true,
  can_view_all_athletes boolean not null default true,
  can_add_athletes_to_lessons boolean not null default true,
  can_take_attendance boolean not null default true,
  can_view_reports boolean not null default true,
  can_manage_training_notes boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.coach_permissions (coach_id, organization_id)
select p.id, p.organization_id
from public.profiles p
where p.role = 'coach'
  and p.organization_id is not null
on conflict (coach_id) do nothing;

create index if not exists idx_coach_permissions_org on public.coach_permissions (organization_id, coach_id);

alter table public.coach_permissions enable row level security;

drop policy if exists coach_permissions_select_policy on public.coach_permissions;
create policy coach_permissions_select_policy on public.coach_permissions
for select
using (
  organization_id = (nullif(auth.jwt() ->> 'organization_id', '')::uuid)
  and (
    coalesce(auth.jwt() ->> 'role', '') = 'admin'
    or coach_id = auth.uid()
  )
);
