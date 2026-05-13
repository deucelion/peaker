-- ============================================================================
-- notifications.type — bildirim tipi alanı (Faz 3.5 plan / Faz 4 uygulama)
--
-- Hedef:
--   notification_preferences (20260510) ile birlikte, server tarafının her
--   bildirimi mantıksal bir tiple yazabilmesi (ör. "lesson.created",
--   "payment.overdue"). Mute kontrolü bu kolona göre yapılır.
--
-- Geriye uyumluluk:
--   * Kolon nullable eklenir; mevcut satırlar `null` kalır (tip belirsiz).
--   * Server tarafındaki `insertNotificationsForUsers(...)` mevcut çağrıları
--     `type` parametresi olmadan çağırmaya devam edebilir; null tipler her
--     kullanıcıya iletilir (mute kontrolü dışı kalır → davranış bozulmaz).
--   * Yeni call site'lar tip set ederse mute kontrolü devreye girer.
--
-- Veri bütünlüğü:
--   * Tip değeri serbest text (canonical anahtarlar `domain.action` formatı).
--   * Index: tipe göre filtreleme bildirim listesinde nadirdir; sade tutuldu.
--     `(user_id, created_at desc)` zaten yeterli. Tip bazlı analitik için
--     ileride `(user_id, type, created_at desc)` eklenebilir.
-- ============================================================================

alter table public.notifications
  add column if not exists type text null;

comment on column public.notifications.type is
  'Bildirim mantıksal tipi (canonical anahtar, ör. "lesson.created", "payment.overdue"). null = legacy/önceki sürüm satırı; mute kontrolü dışındadır.';

notify pgrst, 'reload schema';
