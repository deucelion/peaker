# Wave 4 — Kill Switch Staging + Core Parity CI

**FAZ reference:** 33.3.4, 33.4.4 (core)  
**Wave doc:** [../wave-progress.md](../wave-progress.md) · [../ci-plan.md](../ci-plan.md)

---

## Objective

Enable `PEAKER_ORG_BRANDING=1` on staging; ship core CI gates (token parity, provider contract, me-access schema, partial color allowlist).

---

## Scope

- In scope: runbook, parity scripts, CI job (core), staging env flip
- Out of scope: production env, full allowlist empty (Wave 14)

---

## Dependencies

- **Waves 1–3** merged
- Staging environment access
- Test org configured via Wave 3 admin

---

## Blockers

- Ops approval for staging kill switch

---

## Files

### New (planned)

- `scripts/branding-parity-check.ts`
- `scripts/branding-color-allowlist.json`
- `.github/workflows/branding-parity.yml` (or extend existing)
- `docs/branding/runbooks/kill-switch.md`

### Modified (planned)

- `src/lib/navigation/layoutThemeTokens.test.ts` (export parity helpers for CI)
- `src/lib/ui/branding/contentThemeParity.test.ts`

---

## Validation

- [ ] Staging uses DB branding when env ON
- [ ] Kill switch OFF in CI → all tests pass
- [ ] Default org pixel parity tests pass
- [ ] Custom org smoke on staging documented

---

## Rollback

Unset `PEAKER_ORG_BRANDING` → instant default (FAZ 32).

---

## Risks

| Risk | Level |
|------|-------|
| Premature production flip | **High** (ops) |
| CI false positives | Medium |

---

## Testing

| Type | Planned |
|------|---------|
| CI | Parity, contract, allowlist (warn) |
| Playwright | Staging custom org smoke |
| Manual | Designer QA on staging |

---

## Expected Outcome

Staging reflects real org branding for surface waves.

**Coverage increase:** Operational unlock

---

## Estimated LOC

~200–350

---

## Estimated Duration

2–4 days

---

## PR Checklist

- [ ] Runbook reviewed by ops
- [ ] Staging env documented in runbook
- [ ] CI job non-blocking on first merge if needed

---

## Implementation TODO

- [ ] Parity check script
- [ ] Allowlist initial population (full repo inventory)
- [ ] CI workflow wiring
- [ ] Kill switch runbook
- [ ] Staging env flip (ops task, document date)

---

## Implementation notes

<!-- Append after PR -->
