-- Sporcu login loop fix:
-- 1) Legacy 'athlete' rolünü 'sporcu'ya normalize et
-- 2) profiles SELECT policy'de self-read için role şartını kaldır

update public.profiles
set role = 'sporcu'
where lower(coalesce(role, '')) = 'athlete';

drop policy if exists "profiles_select_org_scope" on public.profiles;
create policy "profiles_select_org_scope"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'admin'
        or (
          me.role = 'coach'
          and me.organization_id = profiles.organization_id
        )
        or me.id = profiles.id
      )
  )
);
