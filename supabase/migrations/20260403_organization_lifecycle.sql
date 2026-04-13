-- Organization lifecycle: status, subscription window, updated_at
-- Not: public.organizations tablosu mevcut FK'lerle zaten var kabul edilir.

alter table public.organizations
  add column if not exists status text not null default 'active';

alter table public.organizations
  add column if not exists starts_at timestamptz;

alter table public.organizations
  add column if not exists ends_at timestamptz;

alter table public.organizations
  add column if not exists updated_at timestamptz not null default now();

-- Mevcut satırlar: abonelik başlangıcı bilinmiyorsa şu an
update public.organizations
set starts_at = coalesce(starts_at, now())
where starts_at is null;

alter table public.organizations
  drop constraint if exists organizations_status_check;

alter table public.organizations
  add constraint organizations_status_check
  check (status in ('active', 'suspended', 'archived', 'trial', 'expired'));

create or replace function public.set_organization_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_organization_updated_at();

-- RLS: kullanıcı yalnızca kendi organizasyon satırını okuyabilsin (middleware / API gate)
alter table public.organizations enable row level security;

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

-- Yazma yalnızca service role (server actions) ile; authenticated için update/insert politikası eklenmedi.
