-- Saha testi upsert akisi icin conflict hedefi:
-- onConflict: (profile_id, test_id, test_date)
-- Bu migration, conflict hedefini garanti eder ve varsa duplicate satirlari tek kayda indirger.

-- 1) Olasi duplicate kayitlari temizle (en gunceli tut)
with ranked as (
  select
    id,
    row_number() over (
      partition by profile_id, test_id, test_date
      order by id desc
    ) as rn
  from public.athletic_results
)
delete from public.athletic_results ar
using ranked r
where ar.id = r.id
  and r.rn > 1;

-- 2) Upsert conflict hedefini destekleyen unique index
create unique index if not exists uq_athletic_results_profile_test_date_conflict
  on public.athletic_results (profile_id, test_id, test_date);
