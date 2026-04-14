alter table public.coach_permissions
  add column if not exists can_view_all_organization_lessons boolean not null default true;
