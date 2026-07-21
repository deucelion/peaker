-- Aynı koç / aynı zaman diliminde birden fazla planlı özel ders (farklı sporcular).
alter table public.private_lesson_sessions
  drop constraint if exists private_lesson_sessions_no_overlap_planned;
