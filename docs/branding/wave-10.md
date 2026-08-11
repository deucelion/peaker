# Wave 10 — Floating UI & Navigation

**FAZ reference:** 33.2c.2–3, 33.2d.3  
**Wave doc:** [../wave-progress.md](../wave-progress.md)

---

## Objective

Menu/listbox, chart tooltip selector, toast neutral shell (semantic frozen), unified tabs/breadcrumb, sticky toolbar class.

---

## Scope

- Export menu, antrenman lesson listbox, ChartFrame/chartTooltipStyle, OfflineActionToast shell, Notification info shell
- PerformanceTabsNav, AthleteDetailSectionNav, FieldTestSessionSubNav, PageSubnav, PerformanceBreadcrumb, antrenman tabs, WeeklyTopBar

---

## Dependencies

- **Wave 5** (tabs), **Wave 7** (menu)

---

## Blockers

- Wave 7 for menu primitives

---

## Files

### Modified (planned)

- `src/components/finance/FinanceExportMenu.tsx`
- `src/app/(dashboard)/antrenman-yonetimi/page.tsx`
- `src/components/ui/charts/ChartFrame.tsx`
- `src/lib/ui/branding/chartSelectors.ts` (new)
- `src/components/offline/OfflineActionToast.tsx`
- `src/components/Notification.tsx`
- `src/components/performance/PerformanceTabsNav.tsx`
- `src/components/performance/AthleteDetailSectionNav.tsx`
- `src/app/(dashboard)/saha-testleri/_components/FieldTestSessionSubNav.tsx`
- `src/components/ui/layout/PageHeader.tsx`
- `src/components/performance/PerformanceBreadcrumb.tsx`
- `src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyTopBar.tsx`

### New (planned)

- `src/components/ui/navigation/UiTabsNav.tsx`
- `src/components/ui/navigation/UiBreadcrumb.tsx`

---

## Validation

- [ ] Chart tooltip WCAG contrast (custom primary)
- [ ] Tab `aria-current`
- [ ] Toast semantic colors unchanged
- [ ] ~4 duplicate tab patterns removed

---

## Rollback

Per-component revert.

---

## Risks

| Risk | Level |
|------|-------|
| Tooltip contrast | Medium |

---

## Testing

| Type | Planned |
|------|---------|
| Storybook | Menu, tabs, breadcrumb, tooltip |
| Playwright | Export menu Escape |

---

## Expected Outcome

Unified navigation/floating UI primitives.

**Coverage increase:** +6–9%

---

## Estimated LOC

~450–650

---

## Estimated Duration

5–7 days

---

## PR Checklist

- [ ] Semantic toast interior unchanged
- [ ] Storybook nav stories

---

## Implementation TODO

- [ ] OverlayMenu migration
- [ ] chartTooltipStyle → selector
- [ ] UiTabsNav + migrate nav components
- [ ] UiBreadcrumb
- [ ] Toast shell only

---

## Implementation notes

<!-- Append after PR -->
