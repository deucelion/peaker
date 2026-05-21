# FAZ 23 — Mobile UX Audit

Tarih: 2026-05-21 · Kod incelemesi + mevcut responsive sınıflar.

## Özet

| Önem | Sayı (tahmini) |
|------|----------------|
| Kritik | 4 |
| Orta | 9 |
| Düşük | 6 |

## Kritik

1. **Muhasebe / alacak tabloları** — Geniş kolon seti; mobilde yatay kaydırma veya kart görünümü gerekir (`overflow-x-auto` tutarlı değil).
2. **Haftalık çizelge grid** — Desktop grid mobilde `WeeklyMobileList` ile telafi ediliyor; çok yoğun haftalarda kart tıklama alanı dar kalabiliyor.
3. **Hızlı işlem menüsü** — Layout header’da `hidden sm:block`; koç mobilde hızlı işlemlere erişemiyordu → FAZ23 `CoachMobileQuickStrip` ile giderildi.
4. **Offline finans** — Tahsilat / paket lifecycle offline otomatik gitmemeli → kuyruk `requires_confirmation` / `blocked` sınıflandırması.

## Orta

1. **Ders detay modalı** — Küçük ekranda çok buton; sticky footer ve `max-h-[90dvh]` ile iyileştirildi.
2. **Özel ders tamamlandı onayı** — İkinci adım paneli mobilde uzun; kompakt footer.
3. **Yoklama** — Toplu seçim + tablo; mobilde satır yüksekliği ve touch target kontrolü önerilir.
4. **Paket detay** — Çok panel; mobilde dikey stack zaten var, padding hâlâ büyük olabilir.
5. **Bildirimler** — Liste OK; uzun mesajlarda `break-words` gerekli.
6. **Takım yönetimi** — Grid/liste desktop ağırlıklı.
7. **Sporcu paneli** — FAZ22 ile küçültüldü; grafik kartları hâlâ `min-h` ile yer kaplar.
8. **Sidebar** — `100dvh` + safe-area iyi; içerik `pb` safe-area ile uyumlu.
9. **Klavye** — Form sayfalarında `pb` artırılmalı (sabah raporu `env(safe-area)` mevcut).

## Düşük

1. Rol rozeti “ELITE ATHLETE” → “Sporcu” (layout).
2. Dekoratif büyük başlıklar (admin ana sayfa).
3. `WeeklyLessonCard` lane overlap tooltip.
4. PWA ikon seti — tek renk SVG; store-quality PNG ileride.
5. Landscape tablet — çizelge iki kolon yerine liste tercih edilebilir.
6. Koç paneli istatistik kartları — `sm:grid` yeterli.

## FAZ23 ile ele alınanlar

- PWA `manifest.ts` + `/offline` fallback
- `src/lib/offline/*` kuyruk + güvenlik scope
- `OfflineBanner`, `SyncStatusBadge`, `PendingActionsDrawer`
- `CompactModalFooter`, mobil lesson modal
- `CoachMobileQuickStrip`, `AthleteMobileQuickStrip`

## Manuel QA

Bkz. kullanıcı checklist (FAZ23 çıktı §12).
