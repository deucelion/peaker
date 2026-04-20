alter table public.profiles
  add column if not exists next_aidat_due_date date null,
  add column if not exists next_aidat_amount numeric(12,2) null;
