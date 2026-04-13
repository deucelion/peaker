-- Panel / buildMeRolePayload org gate: authenticated kullanici kendi profiles satirini ve
-- profiles.organization_id ile eslesen organizations satirini RLS ile okuyabilmeli.
-- Eski politikalarda (yalnizca sporcu self-read vb.) zincir kirilir; anon client org bos doner.
-- Bu migration idempotent'tur; mevcut dogru semayi tekrar sabitler.

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

drop policy if exists "organizations_select_own_org" on public.organizations;
create policy "organizations_select_own_org"
on public.organizations
for select
to authenticated
using (
  id in (
    select p.organization_id
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id is not null
  )
);
