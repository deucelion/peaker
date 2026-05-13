-- ============================================================================
-- notification_preferences — kullanıcı başına bildirim mute/iletim tercihleri
--
-- Faz 3.5 (planlama) → Faz 4 (uygulama) için kanonik şema. Server tarafı
-- (insertNotificationsForUsers) ve UI bileşenleri henüz bağlanmadı; bu
-- migration yalnızca DB tarafını hazırlar.
--
-- Geriye uyumluluk:
--   * Tablo Supabase Studio'dan manuel kurulmuş olabilir → tüm DDL `if not exists`.
--   * Mevcut kullanıcılar bu tabloda satır olmadan da bildirim alır (varsayılan
--     "tüm tipler aktif" davranışı server tarafında uygulanır).
--   * RLS policy `drop policy if exists` + `create` ile yeniden uygulanır.
--   * `updated_at` trigger'ı her UPDATE'te otomatik now() yazar.
--
-- Güvenlik:
--   * Her kullanıcı YALNIZ kendi satırına SELECT/INSERT/UPDATE/DELETE yapabilir.
--   * organization_id null kalabilir (kullanıcı org'a bağlı olmasa bile tercih
--     tutulabilir); ileride org-bazlı varsayılan profil için kullanılacak.
--
-- Veri bütünlüğü:
--   * `muted_types` jsonb array; server tarafında string[] olarak normalize edilir.
--   * `pk(user_id)` → bir kullanıcının tek bir tercih satırı olabilir.
--   * organizations / profiles satırları silinirse cascade ile tercih de silinir.
-- ============================================================================

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete cascade,
  muted_types jsonb not null default '[]'::jsonb,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- created_at: önceden manuel kurulmuş kurulumlarda eksik olabilir.
alter table public.notification_preferences
  add column if not exists created_at timestamptz not null default now();

-- muted_types defansif: jsonb array değilse 0 etkili (Supabase Studio'da
-- tip değişmez ama check constraint güvence sağlar).
alter table public.notification_preferences
  drop constraint if exists notification_preferences_muted_types_is_array;

alter table public.notification_preferences
  add constraint notification_preferences_muted_types_is_array
  check (jsonb_typeof(muted_types) = 'array');

-- organization_id sorguları için secondary index.
create index if not exists idx_notification_preferences_organization_id
  on public.notification_preferences (organization_id);

-- updated_at otomatik bump.
create or replace function public.notification_preferences_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_updated_at_trg on public.notification_preferences;

create trigger notification_preferences_updated_at_trg
  before update on public.notification_preferences
  for each row
  execute function public.notification_preferences_set_updated_at();

-- RLS: kullanıcı yalnızca kendi tercih satırına dokunabilir.
alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_self_select on public.notification_preferences;
create policy notification_preferences_self_select on public.notification_preferences
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists notification_preferences_self_insert on public.notification_preferences;
create policy notification_preferences_self_insert on public.notification_preferences
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists notification_preferences_self_update on public.notification_preferences;
create policy notification_preferences_self_update on public.notification_preferences
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists notification_preferences_self_delete on public.notification_preferences;
create policy notification_preferences_self_delete on public.notification_preferences
  for delete to authenticated
  using (auth.uid() = user_id);

-- Ek olarak super_admin tüm kayıtları okuyabilir (denetim/destek için);
-- yazma hakkı yine kullanıcının kendisinde.
drop policy if exists notification_preferences_super_admin_read on public.notification_preferences;
create policy notification_preferences_super_admin_read on public.notification_preferences
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'super_admin'
    )
  );

comment on table public.notification_preferences is
  'Kullanıcı başına bildirim tercihleri (Faz 3.5 plan / Faz 4 uygulama). Tipler muted_types[] ile mute edilir; kritik tipler server tarafında zorla geçer.';
comment on column public.notification_preferences.muted_types is
  'jsonb string array, ör. ["lesson.created", "attendance.missed"]. Kritik tipler ("payment.overdue", "lesson.cancelled") server tarafında bu listeyi yok sayar.';
comment on column public.notification_preferences.email_enabled is
  'İleride e-mail iletim entegrasyonu için. Varsayılan true; server şu an kullanmaz.';
comment on column public.notification_preferences.push_enabled is
  'İleride push iletim entegrasyonu için. Varsayılan true; server şu an kullanmaz.';

notify pgrst, 'reload schema';
