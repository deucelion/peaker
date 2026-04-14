alter table public.coach_permissions
  add column if not exists can_manage_athlete_profiles boolean not null default true;

alter table public.coach_permissions
  add column if not exists can_manage_teams boolean not null default true;
