# Workflow-First Navigation (Yonetim)

Bu belge, yonetim panelindeki yeni workflow-first gezinim yapisini ve gecis kararlarini ozetler.

## Yeni Sidebar

Yonetim rolleri (admin/coach) icin ana sidebar 5 basliga indirildi:

1. `Ana Panel` (`/`)
2. `Sporcu Yonetimi` (`/oyuncular`)
3. `Antrenman Yonetimi` (`/antrenman-yonetimi`)
4. `Performans ve Raporlar` (`/performans`)
5. `Odemeler (Aidat)` (`/finans`)

`Koclar` sayfasi admin-ozel ek bir giris olarak korunur.

## Birlesen Ust Seviye Akislar

- `Antrenman Yonetimi` aktifligi su route gruplarini kapsar:
  - `/antrenman-yonetimi`
  - `/dersler`
  - `/haftalik-ders-programi`
  - `/ozel-ders-paketleri`
  - `/notlar-haftalik-program`
- `Performans ve Raporlar` aktifligi su route gruplarini kapsar:
  - `/performans`
  - `/saha-testleri`
  - `/idman-raporu`
- `Sporcu Yonetimi` aktifligi su route gruplarini kapsar:
  - `/oyuncular`
  - `/sporcular/yeni`
  - `/takimlar`
  - `/koclar`
  - `/sporcu`

## Paket Konumlandirmasi

Urun karari dogrultusunda `Ozel Ders Paketleri`, finans modulu disinda antrenman hizmet akisinin parcasi kabul edilir.
Bu nedenle yonetim navigasyonunda birincil konum `Antrenman Yonetimi`dir.

## Kullanici Akis Ornekleri

### Bir sporcuya ozel ders tanimlama

1. `Sporcu Yonetimi` icinden sporcu secilir.
2. `Antrenman Yonetimi` altindan `Ozel Ders Paketleri`ne gecilir.
3. Paket olusturulur ve planli oturum tanimlanir.
4. Yoklama/gerceklesme takibi `Antrenman Yonetimi` yoklama moduluyle tamamlanir.

### Bugunku ders operasyonu

1. `Antrenman Yonetimi` acilir.
2. Ders secimi ve kadro filtrelenir.
3. Yoklama tekli/toplu guncellenir.
4. Gerekirse `Ders Olustur` veya `Haftalik Plan` sekmesine gecilir.

### Performans degerlendirmesi

1. `Performans ve Raporlar` acilir.
2. Yonetici/koch ayni modulden `Yuk Analizi`, `Saha Testleri`, `Idman Raporu` alt sayfalarina gecer.

## Quick Actions

Header'da `Hizli Islem` menusu:

- Yeni Ders
- Ozel Ders Planla
- Sporcu Ekle
- Aidat Odemesi Kaydet
- Yoklama Al
- Saha Testi Girisi

Bu kisayollar route ezberleme ihtiyacini azaltir ve gorev odakli hareketi hizlandirir.
