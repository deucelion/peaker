# Wave 13 — Empty / Loading / KPI + Legacy Deprecation

**FAZ reference:** 33.2d.4 + 33.2c.4 toast shell remainder  
**Wave doc:** [../wave-progress.md](../wave-progress.md)

---

## Objective

Tokenize EmptyState, Skeleton*, LoadingState, QueryLoadingShell, KPI grids; deprecate EmptyStateCard; AthleteMetricCard edit ring.

---

## Scope

- Empty/loading/skeleton components
- PerformanceOrgSummaryBand, org KPI grid components, dashboard home KPI
- EmptyStateCard → EmptyState redirect
- Toast shell items not completed in Wave 10 (if any remainder)

---

## Dependencies

- **Wave 5**

---

## Blockers

- Wave 5 merged

---

## Files

### Modified (planned)

- `src/components/ui/EmptyState.tsx`
- `src/components/ui/skeletons/Skeleton.tsx`
- `src/components/ui/data-display/LoadingState.tsx`
- `src/components/ui/loading/QueryLoadingShell.tsx`
- `src/components/compact/CompactMetricCard.tsx`
- `src/components/performance/PerformanceOrgSummaryBand.tsx`
- `src/app/(dashboard)/muhasebe-finans/_components/MuhasebeKpiGrid.tsx`
- `src/components/athlete/AthleteMetricCard.tsx`
- `src/app/(dashboard)/page.tsx`
- `src/components/EmptyStateCard.tsx` (deprecate redirect)
- `src/components/athlete/AthleteEmptyState.tsx`

---

## Validation

- [ ] EmptyState semantic variants unchanged (permission, error, onboarding)
- [ ] KPI semantic tones (amber/red/emerald) frozen
- [ ] Skeleton pulse uses content surface token

---

## Rollback

Revert shell token bind on EmptyState only.

---

## Risks

| Risk | Level |
|------|-------|
| Semantic empty variants | Low |

---

## Testing

| Type | Planned |
|------|---------|
| Storybook | Empty, skeleton, KPI |
| Visual | Skeleton load state |

---

## Expected Outcome

Two empty systems → one; loading aligned.

**Coverage increase:** +5–7%

---

## Estimated LOC

~400–550

---

## Estimated Duration

4–6 days

---

## PR Checklist

- [ ] EmptyStateCard @deprecated
- [ ] All EmptyStateCard consumers migrated or redirected

---

## Implementation TODO

- [ ] Tokenize empty/loading/skeleton shells
- [ ] KPI ui-kpi-card pattern
- [ ] Deprecate EmptyStateCard
- [ ] Storybook stories

---

## Implementation notes

<!-- Append after PR -->
