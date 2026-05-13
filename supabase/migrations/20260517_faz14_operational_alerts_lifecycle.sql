-- Faz 14.4 — Operational alerts: acknowledge + escalation metadata (nullable defaults).
-- Rollback: 20260517_faz14_operational_alerts_lifecycle_rollback.sql

alter table public.peaker_operational_alerts
  add column if not exists acknowledged_at timestamptz null,
  add column if not exists acknowledged_by uuid null references public.profiles(id) on delete set null,
  add column if not exists escalation_count integer not null default 0,
  add column if not exists last_escalated_at timestamptz null,
  add column if not exists noise_suppressed boolean not null default false;

comment on column public.peaker_operational_alerts.acknowledged_at is
  'Faz 14.4 — Admin onayı (open → acknowledged).';
comment on column public.peaker_operational_alerts.escalation_count is
  'Faz 14.4 — Kritik tekrar tespit sayacı (cooldown senkronu uygulama katmanında).';
