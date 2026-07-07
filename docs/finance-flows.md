# Finans akış rehberi

## Giriş noktaları

| Rol | Ana rota | Açıklama |
|-----|----------|----------|
| Admin | `/tahsilat-merkezi` | Tahsilat Merkezi hub |
| Koç | `/finans` | Sporcu ödeme listesi (tüm zaman) |
| Sporcu | `/sporcu/finans` | Salt okunur finans detayı |

**Eski URL'ler:** `/muhasebe-finans` → `?bolum=tahsilatlar`; admin `/finans` → `?bolum=sporcular`.

## Tahsilat Merkezi sekmeleri

| Sekme | URL | Kapsam |
|-------|-----|--------|
| Özet | `/tahsilat-merkezi` | KPI, uyarılar, hızlı geçiş |
| Tahsilatlar | `?bolum=tahsilatlar` | Dönemsel tahsilat listesi |
| Alacaklar | `?bolum=alacaklar` | Borç / vade takibi |
| Sporcular | `?bolum=sporcular` | Tüm zaman sporcu özeti |
| Koçlar | `?bolum=koclar` | Koç ders raporu |

## URL parametreleri

| Parametre | Amaç |
|-----------|------|
| `?bolum=tahsilat` | Tahsilat kaydet drawer (deep link) |
| `?sporcu=&paket=&tur=` | Tahsilat formu ön doldurma |
| `?durum=gecmis` | Tahsilatlar sekmesinde bekleyen preset |
| `?org=UUID` | Super admin org scope |

## Tahsilat semantiği

- **Admin** `createAccountingPayment` → kayıt **ödendi**
- **Koç** `createOrgPayment` → aidat/extra genelde **bekliyor**

## Export

- Tahsilatlar sekmesi: **Dışa aktar → Tahsilat listesi**
- Alacaklar sekmesi: **Dışa aktar → Gecikmiş / Sporcu borcu / Paket borcu**
