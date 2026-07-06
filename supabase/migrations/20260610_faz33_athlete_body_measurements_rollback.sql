drop index if exists public.idx_athlete_metrics_org_profile_date;
drop index if exists public.uq_athlete_metrics_profile_day;

-- Tablo legacy veri taşıyorsa drop edilmez; yalnızca Faz 33 indeksleri geri alınır.
