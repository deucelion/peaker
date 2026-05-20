-- Rollback Faz 18 — package events + lifecycle columns (veri kaybı: events silinir).

drop table if exists public.private_lesson_package_events;

alter table public.private_lesson_packages drop column if exists next_payment_due_at;
alter table public.private_lesson_packages drop column if exists installment_interval_days;
alter table public.private_lesson_packages drop column if exists installment_count;
alter table public.private_lesson_packages drop column if exists lifecycle_status;
