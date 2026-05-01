-- Coach payment rules (per org + coach + lesson scope)
create table if not exists public.coach_payment_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  payment_type text not null check (payment_type in ('per_lesson', 'percentage')),
  amount numeric(12, 2),
  percentage numeric(5, 2),
  applies_to text not null check (applies_to in ('group', 'private', 'all')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_payment_rules_amount_or_pct check (
    (payment_type = 'per_lesson' and amount is not null and percentage is null)
    or (payment_type = 'percentage' and percentage is not null and amount is null)
  ),
  constraint coach_payment_rules_pct_range check (
    percentage is null or (percentage >= 0 and percentage <= 100)
  )
);

create unique index if not exists coach_payment_rules_org_coach_applies_unique
  on public.coach_payment_rules (organization_id, coach_id, applies_to);

create index if not exists idx_coach_payment_rules_org_coach
  on public.coach_payment_rules (organization_id, coach_id);

alter table public.coach_payment_rules enable row level security;

drop policy if exists coach_payment_rules_select_org_scope on public.coach_payment_rules;
create policy coach_payment_rules_select_org_scope
  on public.coach_payment_rules
  for select
  using (organization_id::text = auth.jwt() ->> 'organization_id');

-- Payout line amounts (nullable; backward compatible)
alter table public.coach_payout_items
  add column if not exists payout_amount numeric(12, 2),
  add column if not exists calculated_at timestamptz;
