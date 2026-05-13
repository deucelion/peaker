-- /anket: submitAthleteTrainingLoadSurvey training_loads.session_type kolonuna yazıyor
-- ancak uzak DB'de bu kolon yok → PGRST204 (schema cache).
-- Bu migration sütunu güvenli (idempotent) ekler ve PostgREST schema cache'ini yeniler.

alter table public.training_loads
  add column if not exists session_type text;

update public.training_loads
set session_type = 'Antrenman'
where session_type is null;

alter table public.training_loads
  alter column session_type set default 'Antrenman';

alter table public.training_loads
  alter column session_type set not null;

comment on column public.training_loads.session_type is
  'Sporcu RPE anketinde girilen seans/aktivite türü (örn. "Antrenman", "Maç", "Saha çalışması").';

-- PostgREST cache reload (Supabase): yeni kolon hemen API üzerinden okunabilir/yazılabilir olsun.
notify pgrst, 'reload schema';
