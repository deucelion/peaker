# Production Smoke Checklist (FAZ 27)

## A — Auth & dashboard

- [ ] Login (admin)
- [ ] Login (coach)
- [ ] Org scope doğru
- [ ] Dashboard yüklenir

## B — Sporcu & paket

- [ ] Sporcu oluştur
- [ ] Özel ders paketi oluştur
- [ ] Ders planla (haftalık çizelge)

## C — Özel ders tamamlandı

- [ ] Dersi tamamlandı işaretle
- [ ] Paket hakkı bir kez düşer (çift kullanım yok)

## D — Finans

- [ ] Tahsilat kaydı
- [ ] Alacaklar / muhasebe dashboard

## E — Realtime

- [ ] Bildirim badge başka sekmede güncellenir (opsiyonel)

## F — Audit export

- [ ] Audit CSV export (7 gün)

## G — Offline

- [ ] Sabah raporu offline taslak
- [ ] Online → güvenli sync

## H — Queue

- [ ] Sistem operasyonları → kuyruk metrikleri
- [ ] Worker nabız aktif

## Regresyon

- [ ] Logout → başka kullanıcı → eski offline queue yok
- [ ] Finansal işlem offline blocked
