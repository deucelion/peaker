-- Koç (ve tüm profiller) için hesap aktif/pasif bayrağı — coach lifecycle icin kullanilir.
alter table public.profiles
  add column if not exists is_active boolean not null default true;

comment on column public.profiles.is_active is 'false: kullanici oturum acabilir ancak koç operasyonlari ve panel (proxy) engellenir; admin tarafindan tekrar acilir.';
