# Wave 8 — Modal Migration

**FAZ reference:** 33.2c modal primitive consumption  
**Wave doc:** [../wave-progress.md](../wave-progress.md)

---

## Objective

Migrate **all center/bottom modals** to `OverlayDialog` / sheet variant (~14 files), grouped by primitive not product domain.

---

## Scope

All `fixed inset-0` center/bottom dialog patterns; preserve semantic interior on overlap confirm modal.

---

## Dependencies

- **Wave 7**

---

## Blockers

- Wave 7 merged

---

## Files

### Modified (planned)

- `src/app/(dashboard)/haftalik-ders-programi/_components/QuickCreateLessonModal.tsx`
- `src/app/(dashboard)/haftalik-ders-programi/_components/LessonDetailModal.tsx`
- `src/app/(dashboard)/haftalik-ders-programi/_components/OverlapListModal.tsx`
- `src/components/privateLessons/PrivateLessonPackageFormModal.tsx`
- `src/components/privateLessons/PrivateLessonPackageEditModal.tsx`
- `src/components/privateLessons/PrivateLessonSlotOverlapConfirmModal.tsx`
- `src/components/privateLessons/PackageDetailFaz18Panels.tsx`
- `src/app/(dashboard)/koclar/page.tsx`
- `src/app/(dashboard)/ozel-ders-paketleri/page.tsx`
- `src/app/(dashboard)/ozel-ders-paketleri/[packageId]/page.tsx`
- `src/app/(dashboard)/sistem-operasyonlari/page.tsx`
- `src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentModal.tsx`
- `src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentsTable.tsx`
- `src/app/(dashboard)/tahsilat-merkezi/page.tsx`

---

## Validation

- [ ] z-index vs offline toast (125/130)
- [ ] Nested modal stack (payments flow)
- [ ] Mobile safe-area
- [ ] Semantic warning/critical colors on overlap confirm unchanged

---

## Rollback

Per-file revert; keep Wave 7 primitives.

---

## Risks

| Risk | Level |
|------|-------|
| z-index conflicts | **High** |
| Nested dialogs | Medium |

---

## Testing

| Type | Planned |
|------|---------|
| Playwright | Escape, focus trap |
| Visual | 6-modal screenshot matrix |
| Performance | INP modal open |

---

## Expected Outcome

~200–400 LOC duplicate modal shell removed.

**Coverage increase:** +6–9%

---

## Estimated LOC

~500–750 net

---

## Estimated Duration

6–8 days

---

## PR Checklist

- [ ] OVERLAY_Z only in overlay code
- [ ] Semantic modal interiors verified

---

## Implementation TODO

- [ ] Migrate each file to OverlayDialog
- [ ] Remove duplicate backdrop JSX
- [ ] Update allowlist
- [ ] Storybook one domain example

---

## Implementation notes

<!-- Append after PR -->
