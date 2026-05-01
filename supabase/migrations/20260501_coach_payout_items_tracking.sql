create table if not exists public.coach_payout_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in ('group_lesson', 'private_lesson')),
  source_id uuid not null,
  lesson_date date not null,
  status text not null default 'eligible' check (status in ('eligible', 'included', 'paid')),
  created_at timestamptz not null default now()
);

create unique index if not exists coach_payout_items_source_unique
  on public.coach_payout_items (source_type, source_id);

create index if not exists idx_coach_payout_items_org_date
  on public.coach_payout_items (organization_id, lesson_date desc);

create index if not exists idx_coach_payout_items_org_status
  on public.coach_payout_items (organization_id, status);

alter table public.coach_payout_items enable row level security;

drop policy if exists coach_payout_items_select_org_scope on public.coach_payout_items;
create policy coach_payout_items_select_org_scope
  on public.coach_payout_items
  for select
  using (organization_id::text = auth.jwt() ->> 'organization_id');
