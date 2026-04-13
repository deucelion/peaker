-- Data quality guard: her sporcu icin gunde tek wellness raporu.
-- Sabah raporu formundaki upsert ile birlikte duplicate kayitlari engeller.

create unique index if not exists uq_wellness_reports_profile_day
on public.wellness_reports (profile_id, report_date);
