-- Saha sonuclari icin org baglami (RLS coach_org_scope ile uyumlu yazim)
alter table public.athletic_results
  add column if not exists organization_id uuid;

create index if not exists idx_athletic_results_organization_id
  on public.athletic_results (organization_id);
