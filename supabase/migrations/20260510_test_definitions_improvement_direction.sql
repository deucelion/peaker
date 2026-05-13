-- ============================================================================
-- test_definitions.improvement_direction — yön-aware trend (Faz 4.6)
--
-- Hedef:
--   Numeric saha test metriklerinde "iyileşme yönü"nü tanımlamak.
--   - 'higher_better': yüksek değer iyi (ör. dikey sıçrama, max VO2)
--   - 'lower_better':  düşük değer iyi (ör. 30m sürat, dinlenik nabız)
--   - 'unknown':       yön belirsiz / metrik yorumlanamıyor (varsayılan)
--
-- summarizeFieldTestSignalsForAthlete v2 bu kolona bakarak son ölçüm vs öncesi
-- karşılaştırmasını "improved | regressed | stable | unknown" olarak yorumlar.
--
-- Geriye uyumluluk:
--   * Kolon nullable+default 'unknown' olarak eklenir; mevcut metrikler etkilenmez.
--   * UI metrik düzenleme formundan değiştirilebilir; default davranış güvenli
--     ("yorumlanamıyor" = karar motoruna risk etkisi yok).
--   * Eski kurulumlar bu kolonu desteklemese bile server-side fallback ile
--     unknown davranışı uygulanır.
-- ============================================================================

alter table if exists public.test_definitions
  add column if not exists improvement_direction text not null default 'unknown';

alter table if exists public.test_definitions
  drop constraint if exists test_definitions_improvement_direction_check;

alter table if exists public.test_definitions
  add constraint test_definitions_improvement_direction_check
  check (improvement_direction in ('higher_better', 'lower_better', 'unknown'));

comment on column public.test_definitions.improvement_direction is
  'Numeric metrik için iyileşme yönü: higher_better | lower_better | unknown. Performance Center trend analizi bu kolonu kullanır.';

notify pgrst, 'reload schema';
