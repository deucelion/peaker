-- Rollback FAZ 19

drop function if exists public.private_lesson_void_ledger_payment_atomic(uuid, uuid, uuid, text);

drop table if exists public.peaker_receivable_sweep_state;
drop table if exists public.receivable_reminder_sent;

alter table public.private_lesson_payments
  drop column if exists void_reason,
  drop column if exists voided_by,
  drop column if exists voided_at;

drop index if exists idx_plp_active_package;

drop table if exists public.finance_contact_notes;
