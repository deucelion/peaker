# Wave 11 — Tables Complete

**FAZ reference:** 33.2d.1  
**Wave doc:** [../wave-progress.md](../wave-progress.md)

---

## Objective

Tokenize `DataTable`, toolbar, pagination; migrate all **13** inline tables/list-grids.

---

## Scope

- DataTable primitive adoption (currently 0 consumers)
- audit-log, payments dual layout, ops, athlete, team panels, package detail tables
- globals `ui-table*`

---

## Dependencies

- **Wave 5** (pagination)

---

## Blockers

- Wave 5 merged

---

## Files

### Modified (planned)

- `src/components/ui/data-display/DataTable.tsx`
- `src/components/ui/data-display/DataTableToolbar.tsx`
- `src/app/(dashboard)/globals.css`
- `src/app/(dashboard)/audit-log/page.tsx`
- `src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentsTable.tsx`
- `src/app/(dashboard)/muhasebe-finans/_components/MuhasebeReceivablesSection.tsx`
- `src/app/(dashboard)/muhasebe-finans/_components/MuhasebeLessonsTable.tsx`
- `src/app/(dashboard)/muhasebe-finans/_components/MuhasebeCoachesTable.tsx`
- `src/app/(dashboard)/sistem-operasyonlari/page.tsx`
- `src/app/(dashboard)/sporcu/[id]/AthletePerformanceInsightsPanel.tsx`
- `src/app/(dashboard)/sporcu/[id]/AthleteFieldTestsPanel.tsx`
- `src/components/athlete/AthleteBodyMeasurementSection.tsx`
- `src/app/(dashboard)/oyuncular/_components/TeamsListPanel.tsx`
- `src/app/(dashboard)/oyuncular/_components/TeamDetailPanel.tsx`
- `src/components/performance/PerformanceTeamListView.tsx`
- `src/components/privateLessons/PackageDetailFaz18Panels.tsx`

---

## Validation

- [ ] Mobile card / desktop table parity (payments)
- [ ] Horizontal scroll preserved
- [ ] Empty inline states work
- [ ] DataTable: 0 → 13 consumers

---

## Rollback

Revert consumer clusters independently.

---

## Risks

| Risk | Level |
|------|-------|
| Payments responsive layout | **High** |

---

## Testing

| Type | Planned |
|------|---------|
| Storybook | Table, pagination |
| Playwright | Pagination next/prev |
| Visual | 4 table types |

---

## Expected Outcome

~300–500 LOC duplicate table shell removed.

**Coverage increase:** +8–12%

---

## Estimated LOC

~800–1,200

---

## Estimated Duration

8–12 days

---

## PR Checklist

- [ ] ui-table-scroll adoption where needed
- [ ] Allowlist shrink for table files

---

## Implementation TODO

- [ ] Tokenize DataTable
- [ ] Migrate each consumer
- [ ] Storybook table stories

---

## Implementation notes

<!-- Append after PR -->
