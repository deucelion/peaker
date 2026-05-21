# FAZ 20 — Realtime Strategy Audit & Matrix

## 1) Mevcut polling (analiz)

| Alan | Konum | Mevcut davranış |
|------|--------|-----------------|
| Bildirimler (navbar) | `src/app/(dashboard)/layout.tsx` | Supabase `postgres_changes` **+** `setInterval` 15s + sayfa değişiminde yeniden kurulum |
| Sistem operasyonları | `src/app/(dashboard)/sistem-operasyonlari/page.tsx` | Görünür **45s** / gizli **120s** adaptive `setInterval` + `visibilitychange` |
| Muhasebe & Finans | `src/app/(dashboard)/muhasebe-finans/page.tsx` | Sekme görünür olunca debounced `runFetch` (~400ms); ayrı manuel yenile |
| Performans | `src/app/(dashboard)/performans/page.tsx` | Ağırlıkla kullanıcı tetikli `usePerformanceDashboard` — **sürekli polling yok** |
| Queue dashboard | `sistem-operasyonlari` ile birleşik | Aynı adaptive interval |

Diğer: `haftalik-ders-programi` (now line 60s), paket detayı “şimdi” satırı 30s — finans/yoklama ile sınırlı.

## 2) Supabase Realtime nerede mantıklı?

- **`notifications`**: Kullanıcıya özel satırlar, RLS `auth.uid() = user_id` — düşük hacim, anında badge.
- **`payments` / `private_lesson_payments` / `private_lesson_package_events`**: Organizasyon RLS ile sınırlı; finans e-tablo senkronu için **invalidate sinyali** (tam tablo rebroadcast değil).
- **`training_participants`**: Yoklama güncellemesi; admin/koç RLS uyumlu tenant görünürlüğü.

## 3) Adaptive polling nerede daha güvenli?

- **Sistem operasyonları** özet snapshot’ı: çok sayıda aggregate / job / alert; Realtime ile tablo bazlı yayın karmaşık ve DB tetik yükü riskli. Mevcut **görünürlük farkındalı interval** korunur, UX göstergeleri güçlenir.
- **Performans** ağır analitik: anketlenmez; kullanıcı/kalıp değişince yükleme yeterli.

## 4) Worker / telemetry yükü riskleri

- Çok sayıda açık sekmede **aynı kullanıcı** için navbar bildirim interval + realtime → gereksiz sayım API’si. **Gizli sekmede interval seyrekleştirildi**, realtime tetik **throttle**.
- Finans için her olayda tam `loadAccountingFinanceDashboard` → **LR-21** ile uyumlu risk; FAZ 20’de **debounced invalidate** + mümkün olduğunca mevcut filtrelerle tek `refresh`.
- `training_participants` yoğun güncelleme (toplu yoklama) → **debounce 1.2s+** ve sadece dashboard mount iken abone ol.

## 5) Cross-tab duplicate polling

- Navbar bildirim sayacı: her sekme kendi Supabase client / channel’ı — **duplicate** mümkün; kabul edilebilir (RLS + düşük maliyet). Ek: **`BroadcastChannel`** ile finans invalidation senkronu (tepeden tek “touch” ile her sekmede tek debounced refresh).

---

## Realtime strategy matrix (seçim)

| Ekran | Strateji | Gerekçe |
|-------|----------|---------|
| Bildirimler + badge | **Supabase Realtime** (+ throttle + gizli sekme yavaş interval) | RLS kullanıcı scope, düşük hacim, anında UX |
| Muhasebe / finans KPI + tablo + alacak | **Supabase Realtime (org filtresi)** + **BroadcastChannel** + **debounce** | Tenant-safe invalidate; cross-tab; tek heavy fetch / burst |
| Sporcu finans (detay) | **BroadcastChannel** “touch” (aynı org) + mevcut RSC `router.refresh` akışları | Sayfa ayrı route; tam duplicate subscription’dan kaçın |
| Yoklama / bugünkü dersler | **Supabase Realtime** `training_participants` + **soft dashboard refresh** | Minimal state; coach + admin aynı tenant |
| Operasyon paneli | **Adaptive polling** (mevcut) + bağlantı / **degraded** göstergesi | Snapshot ağır; production-safe |
| Performans | **Polling yok** (mevcut) | Kullanıcı tetikli yeterli |
| Presence (kaba) | **Supabase Presence** (kanal başına org) | DB yazımı yok; TTL/heartbeat platform tarafından |

SSE: şu an kullanılmadı; Supabase Realtime zaten WebSocket. İleride dış ERP / export stream için SSE ayrı değerlendirilir.
