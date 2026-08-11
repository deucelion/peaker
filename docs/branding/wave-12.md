# Wave 12 — Charts & Export Branding

**FAZ reference:** 33.2d.2 + PDF/email color  
**Wave doc:** [../wave-progress.md](../wave-progress.md)

---

## Objective

Chart shells, shared tooltips, decouple ChartFrame/NoData; replace `pdfCommon.BRAND_COLOR` with snapshot primary.

---

## Scope

- performans, athlete charts, ops charts, field test report, PerformanceRadar shell
- PDF header color, email template branding

---

## Dependencies

- **Wave 10** (chart tooltip selector)

---

## Blockers

- Wave 10 merged

---

## Files

### Modified (planned)

- `src/app/(dashboard)/performans/page.tsx`
- `src/app/(dashboard)/performans/_components/PerformancePresentational.tsx`
- `src/app/(dashboard)/sporcu/[id]/_components/AthletePerformanceHero.tsx`
- `src/app/(dashboard)/sporcu/[id]/AthletePerformanceInsightsPanel.tsx`
- `src/app/(dashboard)/sistem-operasyonlari/page.tsx`
- `src/app/(dashboard)/saha-testleri/genel-rapor/page.tsx`
- `src/components/PerformanceRadar.tsx`
- `src/components/athlete/AthleteBodyMeasurementSection.tsx`
- `src/components/ui/charts/ChartFrame.tsx`
- `src/lib/pdf/pdfCommon.ts`
- `src/lib/email/emailTemplateBranding.ts`

### New (planned)

- `src/components/ui/data-display/ChartNoData.tsx`

---

## Validation

- [ ] Chart series semantic colors unchanged
- [ ] PDF header rgb matches org primary
- [ ] Tooltip contrast pass

---

## Rollback

Revert chart/PDF files separately.

---

## Risks

| Risk | Level |
|------|-------|
| Contrast failure custom primary | Medium |

---

## Testing

| Type | Planned |
|------|---------|
| Storybook | Chart frame, tooltip |
| Visual | PDF first page diff |
| Playwright | Tooltip hover |

---

## Expected Outcome

PDF export 100% title bar color parity.

**Coverage increase:** +5–8% dashboard

---

## Estimated LOC

~450–650

---

## Estimated Duration

5–7 days

---

## PR Checklist

- [ ] Series colors screenshot comparison
- [ ] PDF sample attached to PR

---

## Implementation TODO

- [ ] ChartNoData decouple
- [ ] Migrate chart pages
- [ ] pdfCommon primary from snapshot
- [ ] Email template alignment

---

## Implementation notes

<!-- Append after PR -->
