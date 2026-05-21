# FAZ 26 — Koç UX Audit

## Kritik

| Sorun | Konum | FAZ 26 aksiyonu |
|--------|--------|------------------|
| Yoklama CTA derin linkte gizli | Dashboard ders kartları | `CompactListRow` + doğrudan yoklama URL |
| Mobil hızlı erişim dashboard’da yok | Ana sayfa (koç) | `CoachMobileQuickStrip` eklendi |
| Düşük bilgi yoğunluğu (büyük boş kartlar) | Bugünkü dersler | Kompakt satır listesi |

## Orta

| Sorun | Konum | FAZ 26 aksiyonu |
|--------|--------|------------------|
| KPI şeridi okunaksız | Header pill’ler | `CompactMetricCard` grid |
| Boş ders metni yönlendirici değil | Bugün ders yok | `EmptyStateCard` + CTA |
| Türkçe tutarsızlık (GUNLUK/Bugun) | Dashboard başlık | Düzeltildi |

## Düşük

| Sorun | Konum | Not |
|--------|--------|-----|
| Özel ders tamamlama haftalık programda | Ayrı akış | Offline blocked — bilinçli |
| Performans grafik mobil overflow | `/performans` | Mevcut `CompactKpi` korundu, Hazırlık etiketi TR |

## Korunan akışlar

- Realtime yoklama badge
- Offline queue / SW
- RLS / server actions
