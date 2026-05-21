# Security Final Pass (FAZ 27)

| Kontrol | Durum |
|---------|--------|
| Cross-tenant queue | `scopeKey` + `purgeOtherScopes` |
| Offline replay | Server action RLS yeniden doğrular |
| Auth token in queue | Yok |
| SW stale auth HTML | Cache policy: no dashboard HTML |
| Export abuse | Rate limit + ops alert |
| Audit access | Admin/coach role gate |
| Finans offline auto-sync | Blocked kinds |
| Realtime payload | Org filter on channels |

## Replay

Tüm replay handler’lar mevcut server action’ları çağırır; ekstra client trust yok.

## Öneri

Periyodik: RLS policy review Supabase dashboard.
