# Wave 5 — Primary Surfaces (Globals → Components)

**FAZ reference:** 33.2a  
**Wave doc:** [../wave-progress.md](../wave-progress.md) · [storybook-plan.md](../storybook-plan.md)

---

## Objective

FAZ 33.2a — **Phase A:** bind `ui-btn*`, `ui-badge*`, `ui-card*`, `ui-toolbar`, `ui-compact-card` to `--peaker-ui-*`. **Phase B:** migrate priority components to shared classes/selectors.

**Order decision:** Globals **before** components minimizes double migration and visual regression (see [execution-plan.md](../execution-plan.md)).

---

## Scope

- Phase A: `globals.css` only
- Phase B: EmptyStateCard CTAs, LoadMoreButton, DataTablePagination, CompactMetricCard, FilterChip
- Storybook: button, badge, card (Phase 0 setup if not done)

---

## Dependencies

- Waves 1, 2, 4 (staging validation recommended)

---

## Blockers

- Wave 6 Phase A requires Wave 5 Phase A complete

---

## Files

### Modified (planned)

- `src/app/(dashboard)/globals.css`
- `src/components/EmptyStateCard.tsx`
- `src/components/ui/data-display/LoadMoreButton.tsx`
- `src/components/ui/data-display/DataTablePagination.tsx`
- `src/components/compact/CompactMetricCard.tsx`
- `src/components/compact/CompactActionCard.tsx`
- `src/components/ui/layout/FilterBar.tsx`

---

## Validation

- [ ] Default org: pixel parity vs pre-wave screenshots
- [ ] Custom org (staging): primary on buttons/cards
- [ ] `ui-btn-danger`, emerald CTAs unchanged
- [ ] Storybook default + custom variants
- [ ] Allowlist reduced for touched files

---

## Rollback

Revert `globals.css` Phase A first (restores all ui-* at once).

---

## Risks

| Risk | Level |
|------|-------|
| Broad CSS blast radius | Medium |

---

## Testing

| Type | Planned |
|------|---------|
| Unit | CSS rule snapshot (no raw hex in migrated rules) |
| Visual | Storybook + 3 dashboard pages |
| Playwright | Custom primary button background |

---

## Expected Outcome

Largest single coverage jump; pattern for remaining waves.

**Coverage increase:** +10–15%

---

## Estimated LOC

~350–550

---

## Estimated Duration

4–6 days

---

## PR Checklist

- [ ] Phase A merged and verified before Phase B in same PR or sequential commits
- [ ] [storybook-plan.md](../storybook-plan.md) button/badge/card stories
- [ ] [governance.md](../governance.md) no new ui-* without vars

---

## Implementation TODO

### Phase A — Globals

- [ ] Bind ui-btn-primary, ui-btn-ghost, ui-btn-danger (danger semantic — verify freeze)
- [ ] Bind ui-badge-*, ui-card, ui-card-chart, ui-toolbar, ui-compact-card

### Phase B — Components

- [ ] Migrate listed components to ui-* / selectors
- [ ] Shrink allowlist entries

### Storybook

- [ ] Setup if not present (Phase 0)
- [ ] Button, badge, card stories

---

## Implementation notes

<!-- Append after PR -->
