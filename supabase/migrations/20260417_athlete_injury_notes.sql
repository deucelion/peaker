create table if not exists public.athlete_injury_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  injury_type text not null,
  note text not null,
  image_paths text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_athlete_injury_notes_org_athlete_created
  on public.athlete_injury_notes (organization_id, athlete_id, created_at desc);

create index if not exists idx_athlete_injury_notes_org_active
  on public.athlete_injury_notes (organization_id, is_active, created_at desc);

alter table public.athlete_injury_notes enable row level security;

drop policy if exists athlete_injury_notes_select_policy on public.athlete_injury_notes;
create policy athlete_injury_notes_select_policy on public.athlete_injury_notes
for select
using (
  organization_id = (nullif(auth.jwt() ->> 'organization_id', '')::uuid)
  and (
    coalesce(auth.jwt() ->> 'role', '') in ('admin', 'coach')
    or athlete_id = auth.uid()
  )
);

drop policy if exists athlete_injury_notes_insert_policy on public.athlete_injury_notes;
create policy athlete_injury_notes_insert_policy on public.athlete_injury_notes
for insert
with check (
  organization_id = (nullif(auth.jwt() ->> 'organization_id', '')::uuid)
  and coalesce(auth.jwt() ->> 'role', '') in ('admin', 'coach')
  and created_by = auth.uid()
);

drop policy if exists athlete_injury_notes_update_policy on public.athlete_injury_notes;
create policy athlete_injury_notes_update_policy on public.athlete_injury_notes
for update
using (
  organization_id = (nullif(auth.jwt() ->> 'organization_id', '')::uuid)
  and coalesce(auth.jwt() ->> 'role', '') in ('admin', 'coach')
)
with check (
  organization_id = (nullif(auth.jwt() ->> 'organization_id', '')::uuid)
  and coalesce(auth.jwt() ->> 'role', '') in ('admin', 'coach')
);

insert into storage.buckets (id, name, public)
values ('injury-note-assets', 'injury-note-assets', false)
on conflict (id) do update set public = excluded.public;
