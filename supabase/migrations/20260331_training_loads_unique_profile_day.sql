-- Data quality guard: her sporcu icin gunde tek training_load kaydi.
-- Bu migration'dan sonra insert yerine upsert kullanilmalidir.

create unique index if not exists uq_training_loads_profile_day
on public.training_loads (profile_id, measurement_date);
