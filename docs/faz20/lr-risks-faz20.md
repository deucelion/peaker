# FAZ 20 — Large-scale & reliability risks (LR-26+)

Realtime ve client tarafı invalidation sonrası izlenmesi gereken riskler.

| ID | Şiddet | Risk | Öneri |
|----|--------|------|--------|
| LR-26 | Orta | Finans için Supabase Realtime + debounced full `runFetch` aynı org’da çok kullanıcıda eşzamanlı olaylarda snapshot yükü artar | Debounce sürelerini telemetry ile izle; gerekirse sadece “payments” tablosuna daralt |
| LR-27 | Düşük | `BroadcastChannel` desteklemeyen ortamlarda cross-tab finans senkronu düşer | Graceful degradation: yalnızca postgres realtime kalır |
| LR-28 | Orta | Çok sekme açık kullanıcı: bildirim polling + realtime çift yol | Gizli sekme interval’i zaten uzun; sayım istekleri throttle’lu |
| LR-29 | Düşük | Presence sayımı rol etiketine bağlı; client manipülasyonu teorik | Presence yalnızca UX; güvenlik kararı RLS/server action’da |
| LR-30 | Orta | `training_participants` realtime yoğun yoklama burst’ünde debounce üstünde bile ekstra `bootstrapTenantHomeDashboard` yükü | İleride sadece ilgili ders satırlarını server action ile partial refresh |
| LR-31 | Düşük | İstemci `clientRealtimeStats` oturum belleğinde; multi-tab konsolidasyon yok | Ops paneli teşhis amaçlı; merkezi sink Faz 21+ |
| LR-32 | Orta | `supabase_realtime` publication genişledikçe Postgres logical replication yükü | Yalnızca gerekli tablolar publication’da tutulsun |
| LR-33 | Düşük | Realtime channel adları düz metin; tenant ID içerir | PII yok; brute-force önemi düşük |
