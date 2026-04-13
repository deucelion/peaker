alter table public.athlete_programs
  add column if not exists content text null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists is_read boolean not null default false,
  add column if not exists is_active boolean not null default true;

update public.athlete_programs
set content = coalesce(content, note)
where content is null;

create index if not exists idx_athlete_programs_athlete_active_created
  on public.athlete_programs (athlete_id, is_active, created_at desc);
