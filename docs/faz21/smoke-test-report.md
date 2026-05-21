# FAZ 21 — Smoke Test & Regression Report (kod incelemesi)

Tarih: 2026-05-20  
Kapsam: Kod tabanı + önceki hotfix (schema compat, audit, realtime). Manuel E2E production’da tenant ile doğrulanmalı.

## 1. Test edilen operasyon akışları (kod yolu)

| Akış | Kod yolu | Durum (kod) |
|------|----------|-------------|
| A — Sporcu onboarding | `athleteOnboardingActions`, `privateLessonPackageActions.create` | ✅ audit/timeline hook’ları mevcut |
| B — Ders operasyonu | `lessonActions`, `attendanceActions`, `privateLessonSessionActions` | ✅ FAZ 21 error hardening PLN-* |
| C — Finans | `paymentRecordActions`, `accountingFinanceActions`, lifecycle actions | ✅ void/correct sanitized; schema compat |
| D — Bildirim/realtime | `useUnreadNotificationsLive`, `financeCrossTab` | ✅ debounce + channel cleanup |
| E — Export/audit | stream routes, `useStreamingCsvDownload` | ✅ rate limit + generic export fail |
| F — Worker/ops | `systemOperationsActions`, `schemaHealthActions` | ✅ diagnostics panel |

## 2. Broken / risk flows

### Kritik

| ID | Akış | Risk | Not |
|----|------|------|-----|
| K1 | Audit “tüm tarihler” | Timeout / AUD-FETCH | **Düzeltildi:** varsayılan son 30 gün |
| K2 | `audit_logs` tablosu yok | Audit tamamen kırık | Migration `20260410` zorunlu |
| K3 | FAZ 18/19 eksik | Paket/finans | Schema compat modu (amber) |

### Orta

| ID | Akış | Risk | Not |
|----|------|------|-----|
| O1 | Çok action dosyasında ham `error.message` | UX / güvenlik | Finans/PLN önceliklendirildi; diğer modüller kademeli |
| O2 | Super admin audit org’suz | Ağır global count | Tarih filtresi kullan |
| O3 | PostgREST cache | “Kolon yok” false negative | `notify pgrst` after migration |

### Düşük

| ID | Akış | Risk | Not |
|----|------|------|-----|
| D1 | `receivable_reminder_sent` RLS yok | Client erişimi teorik | Yalnızca service role kullanıyor |
| D2 | Performans analytics ham hata | Koç rapor ekranı | `performanceAnalyticsActions` |

## 3. UX consistency (yapılan / önerilen)

**Yapılan**

- `InlineErrorState` + `auditListUserMessage` + tanı kodu
- `QueryLoadingShell` / `SoftRefreshIndicator` primitives
- Mevcut `Skeleton*` kitaplığı (`components/ui/skeletons`)

**Önerilen (sonraki iterasyon)**

- Antrenman / performans sayfalarında `Loader2` → `SkeletonTable` ilk yükleme
- Modal ESC/focus trap ortak hook (paket/tahsilat modalları)

## 4. Error language hardening

- Yeni: `src/lib/ui/operationalErrors.ts` (`operationalError`, `diagnosticsCode`)
- `userFacingDataError` → operationalError delegasyonu
- Hardened: `accountingFinanceActions`, `privateLessonSessionActions`, `paymentRecordActions`
- `global-error.tsx`: teknik mesaj yalnızca `development`

## 5. Mobile / tablet

| Alan | Bulgu |
|------|--------|
| Audit filtre chip’leri | `flex-wrap`, `min-h-11` — OK |
| Ops dashboard | Grid + strip — dar ekranda wrap |
| Büyük tablolar | `overflow-x` muhasebe/audit — kontrol önerilir |
| Modals | Paket/tahsilat — `max-h` + scroll doğrulanmalı |

## 6. Loading / skeleton

- `QueryLoadingShell` (inline | table | dashboard)
- `SoftRefreshIndicator` realtime soft refresh için
- Realtime: debounce ile jitter azaltıldı (mevcut FAZ 20)

## 7. Accessibility

- Skeleton/statü: `role="status"`, `aria-label`
- Audit export/filtre: `aria-label` section mevcut
- Modallarda tam focus trap — kısmi (iyileştirme backlog)

## 8. Production safety

| Konu | Bulgu |
|------|--------|
| `__PEAKER_DEBUG__` | DEV only (`PeakerDebugInstaller`) |
| `console.log` accounting | DEV only guard |
| Service role | Server-only admin client |
| Export abuse | Rate limit mevcut |
| Replay | Cooldown mevcut |
| Realtime leak | `removeChannel` on unmount |

## 9. Realtime reliability

- Org-scoped filter
- Hidden tab 4s debounce
- Cross-tab `BroadcastChannel`
- CHANNEL_ERROR → stats bump (reconnect noted)

## 10. Coverage gaps

| Alan | Test dosyası |
|------|----------------|
| operationalErrors | `operationalErrors.test.ts` |
| schema compat | `schemaCompat.test.ts` |
| finance cross-tab | `financeCrossTab.test.ts` |
| Gap | Full E2E Playwright yok |
| Gap | Lifecycle transition integration |
| Gap | Export stream integration |

## 11–13. Performance / polish

- Audit: default 30d → count exact yükü azalır
- Receivables: limit 4000 — büyük org’da izle
- Relative time: `formatRelativeTimeTr` (FAZ 20)

## QA checklist (manuel)

- [ ] Akış A–F tenant’ta uçtan uca
- [ ] Audit 30 gün + export
- [ ] Tahsilat iptal/düzelt (FAZ 19 RPC)
- [ ] İki sekme finans sync
- [ ] Mobile 390px overflow yok
- [ ] Şema sağlığı kartı yeşil
