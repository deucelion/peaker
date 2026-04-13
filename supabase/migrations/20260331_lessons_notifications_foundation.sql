-- Canonical lesson model on existing training_schedule table
alter table if exists public.training_schedule
  add column if not exists coach_id uuid references public.profiles(id) on delete set null,
  add column if not exists description text,
  add column if not exists capacity integer not null default 20,
  add column if not exists status text not null default 'scheduled',
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

-- guardrails
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'training_schedule_capacity_positive'
  ) then
    alter table public.training_schedule
      add constraint training_schedule_capacity_positive check (capacity > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'training_schedule_status_check'
  ) then
    alter table public.training_schedule
      add constraint training_schedule_status_check check (status in ('scheduled', 'completed', 'cancelled'));
  end if;
end $$;

create index if not exists idx_training_schedule_org_time
  on public.training_schedule (organization_id, start_time);

create index if not exists idx_training_schedule_coach_time
  on public.training_schedule (coach_id, start_time);

-- participants relation hardening
create unique index if not exists uq_training_participants_lesson_profile
  on public.training_participants (training_id, profile_id);

-- Simple notification table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

alter table if exists public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
