# FAZ 34 — Wave Progress Checklist

Update this file when a wave PR is opened, reviewed, merged, or released.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Wave 1 — Content Token Foundation

- [ ] Planning reviewed
- [ ] Implementation complete
- [ ] Unit tests
- [ ] Contract tests
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main
- [ ] Staging verified

---

## Wave 2 — Provider Stack

- [ ] Planning reviewed
- [ ] Request cache wired on me-access
- [ ] Provider mounted in dashboard layout
- [ ] SSR branding bootstrap
- [ ] MeAccess fetch dedupe
- [ ] Layout namespace cleanup
- [ ] Performance baseline captured
- [ ] Unit / integration tests
- [ ] Playwright smoke
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main
- [ ] Staging verified

---

## Wave 3 — Branding Admin UI

- [ ] Planning reviewed
- [ ] Super-admin editor route
- [ ] Server action write path
- [ ] Authz review (super_admin only)
- [ ] Manual QA: save + reload
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main
- [ ] Staging verified

---

## Wave 4 — Kill Switch Staging + Core Parity CI

- [ ] Planning reviewed
- [ ] Staging `PEAKER_ORG_BRANDING=1`
- [ ] Runbook documented
- [ ] Core parity CI job
- [ ] Provider contract tests in CI
- [ ] Custom org smoke on staging
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main

---

## Wave 5 — Primary Surfaces (Globals → Components)

- [ ] Planning reviewed
- [ ] Phase A: globals.css token bind
- [ ] Phase B: component migration
- [ ] Storybook: button, badge, card
- [ ] Default org visual parity
- [ ] Custom org staging check
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main

---

## Wave 6 — Form Surfaces

- [ ] Planning reviewed
- [ ] globals form classes
- [ ] FilterBar / MoneyAmountInput
- [ ] Storybook: inputs
- [ ] Semantic finance inputs unchanged
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main

---

## Wave 7 — Overlay Primitives Foundation

- [ ] Planning reviewed
- [ ] Overlay primitives (no domain migration)
- [ ] OVERLAY_Z registry
- [ ] Storybook: dialog, drawer, sheet, menu
- [ ] Focus trap unit tests
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main

---

## Wave 8 — Modal Migration

- [ ] Planning reviewed
- [ ] All modals migrated
- [ ] z-index stack validated
- [ ] Playwright: escape / focus
- [ ] Screenshot matrix
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main

---

## Wave 9 — Drawer/Sheet + Offline Consolidation

- [ ] Planning reviewed
- [ ] Drawer/sheet migration
- [ ] PendingActionsDrawer removed
- [ ] Offline drawer parity
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main

---

## Wave 10 — Floating UI & Navigation

- [ ] Planning reviewed
- [ ] Menu / tooltip / toast shell
- [ ] Tabs / breadcrumb unified
- [ ] Storybook: nav + menu
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main

---

## Wave 11 — Tables Complete

- [ ] Planning reviewed
- [ ] DataTable tokenized
- [ ] All inline tables migrated
- [ ] Mobile/desktop payments layout
- [ ] Storybook: table
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main

---

## Wave 12 — Charts & Export Branding

- [ ] Planning reviewed
- [ ] Chart shells migrated
- [ ] PDF/email primary color
- [ ] Tooltip contrast check
- [ ] PDF visual diff
- [ ] Code review
- [ ] CI green
- [ ] Ready for merge
- [ ] Merged to main

---

## Wave 13 — Empty / Loading / KPI

- [x] Planning reviewed
- [x] EmptyState / Skeleton / Loading
- [x] KPI cards
- [x] EmptyStateCard deprecated
- [x] Storybook: empty + loading
- [x] Code review
- [x] CI green
- [x] Ready for merge
- [x] Merged to main

---

## Wave 14 — White-Label Validation & Full CI Gates

- [x] Planning reviewed
- [x] E2E white-label suite
- [x] Full color allowlist (strict)
- [x] Lighthouse CI blocking
- [x] Performance benchmarks pass
- [x] Production kill switch runbook approved
- [x] Code review
- [x] CI green
- [x] Ready for merge
- [ ] Merged to main
- [ ] **Production readiness sign-off**

---

## Production release gate (after Wave 14)

- [ ] `PEAKER_ORG_BRANDING=1` on production (phased)
- [ ] Custom org pilot complete
- [ ] Rollback drill documented and tested
- [ ] Stakeholder sign-off
