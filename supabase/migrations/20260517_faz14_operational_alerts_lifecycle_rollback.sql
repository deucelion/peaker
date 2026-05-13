-- Rollback: Faz 14.4 operational alert lifecycle columns.

alter table public.peaker_operational_alerts
  drop column if exists noise_suppressed,
  drop column if exists last_escalated_at,
  drop column if exists escalation_count,
  drop column if exists acknowledged_by,
  drop column if exists acknowledged_at;
