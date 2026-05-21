# FAZ 24 — Service Worker Stratejisi

## Güvenli model

| Katman | Politika |
|--------|----------|
| `GET /api/*` | Network only — cache yok |
| Auth / Supabase | Cross-origin — SW dokunmaz |
| Dashboard HTML (`navigate`) | Network first; hata → `/offline` |
| `/_next/static/*`, `/icons/*` | Cache first + güncelleme |
| Server Actions | POST — SW intercept etmez |

## Cache dışı

- `/api/*`, `/auth*`, `/exports/*`, `*.csv`, `realtime`, `/_next/data/*`
- Tüm non-GET istekler
- Cross-origin (Supabase realtime REST)

## Precache

- `/offline`
- `/icons/icon.svg`, `/icons/icon-maskable.svg`

## Versiyon

`peaker-static-v2` — activate'te eski cache silinir.

## Auth riski

Dashboard HTML başarılı yanıtları cache'lenmez; stale auth sayfası üretilmez.
