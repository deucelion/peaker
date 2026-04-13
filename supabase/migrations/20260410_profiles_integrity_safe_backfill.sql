-- Safe profile integrity backfill (production-safe, idempotent)
-- Scope:
-- 1) Normalize known role aliases in profiles
-- 2) Fill missing organization_id for tenant roles using auth.users metadata (only valid UUID)
-- 3) Report-only friendly: does NOT auto-create missing profiles, does NOT delete orphans

update public.profiles
set role = 'super_admin'
where role is not null
  and lower(replace(replace(trim(role), '-', '_'), ' ', '_')) in ('superadmin', 'super_admin');

update public.profiles
set role = 'admin'
where role is not null
  and lower(replace(replace(trim(role), '-', '_'), ' ', '_')) = 'administrator';

update public.profiles
set role = 'sporcu'
where role is not null
  and lower(replace(replace(trim(role), '-', '_'), ' ', '_')) in ('athlete', 'player');

with auth_meta as (
  select
    u.id,
    nullif((u.raw_user_meta_data ->> 'organization_id')::text, '') as org_id_text
  from auth.users u
)
update public.profiles p
set organization_id = auth_meta.org_id_text::uuid
from auth_meta
where p.id = auth_meta.id
  and p.organization_id is null
  and coalesce(p.role, '') <> 'super_admin'
  and auth_meta.org_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
