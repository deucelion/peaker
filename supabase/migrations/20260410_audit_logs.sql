create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  organization_id uuid null references public.organizations(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_org_created_at
  on public.audit_logs (organization_id, created_at desc);

create index if not exists idx_audit_logs_user_created_at
  on public.audit_logs (user_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_policy on public.audit_logs;
create policy audit_logs_select_policy on public.audit_logs
for select to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'super_admin'
        or (me.role = 'admin' and me.organization_id = audit_logs.organization_id)
      )
  )
);
