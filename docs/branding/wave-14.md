# Wave 14 — White-Label Validation & Full CI Gates

**FAZ reference:** 33.3.6 + full CI  
**Wave doc:** [../wave-progress.md](../wave-progress.md) · [../ci-plan.md](../ci-plan.md)

---

## Objective

E2E multi-org validation, full color allowlist (strict), visual regression blocking, production kill switch runbook sign-off.

---

## Scope

- E2E suite, expanded CI, Lighthouse blocking, performance benchmark sign-off
- Production readiness gate — **no new surface migration**

---

## Dependencies

- **Waves 1–13** complete
- Staging kill switch ON since Wave 4

---

## Blockers

- All surface waves merged
- Performance benchmarks pass ([performance-benchmarks.md](../performance-benchmarks.md))

---

## Files

### New (planned)

- `e2e/branding/white-label.spec.ts`
- `e2e/branding/kill-switch.spec.ts`
- `e2e/branding/fixtures/custom-org.ts`
- `docs/branding/runbooks/production-rollout.md`
- Visual baseline directory (tool-specific)

### Modified (planned)

- `.github/workflows/branding-parity.yml` (full strict mode)
- `scripts/branding-color-allowlist.json` (empty or exceptions only)

---

## Validation

- [ ] Measured coverage 50–60% documented
- [ ] Org A → Org B switch E2E
- [ ] Kill switch OFF → default parity
- [ ] Lighthouse gates pass
- [ ] Allowlist empty
- [ ] Stakeholder sign-off recorded

---

## Rollback

N/A (validation wave); production flip rollback via unset env.

---

## Risks

| Risk | Level |
|------|-------|
| Production flip too early | **High** (process) |

---

## Testing

| Type | Planned |
|------|---------|
| E2E | Full white-label matrix |
| Visual | Storybook + 10 pages blocking |
| Lighthouse | Blocking |
| Performance | Full suite blocking |

---

## Expected Outcome

Production readiness sign-off for org branding.

**Coverage increase:** Validation of cumulative 50–60%

---

## Estimated LOC

~350–500 (tests/docs)

---

## Estimated Duration

5–8 days

---

## PR Checklist

- [ ] [wave-progress.md](../wave-progress.md) Wave 14 complete
- [ ] Production runbook approved
- [ ] No open P0 branding bugs

---

## Implementation TODO

- [ ] E2E suite
- [ ] Strict CI gates enabled
- [ ] Lighthouse CI blocking
- [ ] Production rollout runbook
- [ ] Final allowlist empty
- [ ] Executive sign-off checklist

---

## Production release (post-merge)

- [ ] Phased `PEAKER_ORG_BRANDING=1` on production
- [ ] Pilot org monitoring
- [ ] Rollback drill completed

---

## Implementation notes

- Wave 14 strict CI enabled via `BRANDING_PARITY_STRICT=1`.
- Allowlist v2: 146 documented exceptions (127 post-wave backlog, 14 parity fixtures, 3 canonical/layout, 1 globals fallback). Shrunk 17 entries migrated in Wave 13.
- E2E: `e2e/branding/white-label.spec.ts`, `kill-switch.spec.ts`, visual catalog scaffolding.
- Production runbook: `docs/branding/runbooks/production-rollout.md`.
- Benchmarks signed off: `docs/branding/benchmarks/wave14-results.csv` (54% cumulative surface coverage).
- Storybook catalog: 13/13 wave story files verified.
