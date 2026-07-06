-- Faz 33: Sporcu boy/kilo ölçüm geçmişi (Hylyght/RYPT tarzı periyodik antropometri)
-- athlete_metrics tablosunu genişletir veya oluşturur; günde bir ölçüm (upsert).

create table if not exists public.athlete_metrics (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  measurement_date date not null,
  height numeric,
  weight numeric,
  body_fat numeric,
  recorded_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.athlete_metrics add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.athlete_metrics add column if not exists height numeric;
alter table public.athlete_metrics add column if not exists recorded_by uuid references public.profiles(id) on delete set null;
alter table public.athlete_metrics add column if not exists note text;
alter table public.athlete_metrics add column if not exists updated_at timestamptz not null default now();

update public.athlete_metrics am
set organization_id = p.organization_id
from public.profiles p
where am.profile_id = p.id
  and am.organization_id is null
  and p.organization_id is not null;

create unique index if not exists uq_athlete_metrics_profile_day
  on public.athlete_metrics (profile_id, measurement_date);

create index if not exists idx_athlete_metrics_org_profile_date
  on public.athlete_metrics (organization_id, profile_id, measurement_date desc);
