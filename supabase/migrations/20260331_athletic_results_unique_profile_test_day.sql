-- Data quality guard: her sporcu, her test metriği için günde tek sonuç kaydı.
-- Saha testleri ekranındaki upsert akışı ile birlikte duplicate kayıtları engeller.

create unique index if not exists uq_athletic_results_profile_test_day
on public.athletic_results (profile_id, test_id, test_date);
