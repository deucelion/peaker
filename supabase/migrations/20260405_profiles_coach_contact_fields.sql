-- Koç profil düzenleme (telefon / uzmanlık) için opsiyonel alanlar
alter table public.profiles
  add column if not exists phone text;

alter table public.profiles
  add column if not exists specialization text;
