# FAZ 34 — Branding CI Plan

Planning only. **No workflow files** unless extending existing CI with placeholders noted below.

Reference: [governance.md](./governance.md), [execution-plan.md](./execution-plan.md)

---

## CI phases

| Phase | Introduced | Blocking |
|-------|------------|----------|
| Core parity | Wave 4 | Yes |
| Surface allowlist | Wave 5+ | Warn → strict Wave 14 |
| Visual regression | Wave 5+ | Warn → block Wave 14 |
| Performance | Wave 14 | Block production |
| E2E white-label | Wave 14 | Block production |

---

## Planned checks

### Parity tests

| Check | Description | Wave |
|-------|-------------|------|
| Default branding parity | `createDefaultBranding()` ↔ CSS computed defaults | 4 |
| Layout theme parity | `isDefaultLayoutThemeParity()` | 4 |
| Content theme parity | New helper `isDefaultContentThemeParity()` | 4 |
| Selector snapshot JSON | Stable output for default theme | 1, 4 |

### Token contract

| Check | Description | Wave |
|-------|-------------|------|
| `UI_CONTENT_THEME_VARS` keys complete | Every selector key has CSS var | 1, 2 |
| No orphan `--peaker-ui-*` in globals | Vars declared match provider injection | 5 |
| Canonical keys ⊆ server tokens | Contract test | 1 |

### Provider contract

| Check | Description | Wave |
|-------|-------------|------|
| Context required fields | organizationBranding, brandingRevision, features | 2 |
| CSS vars on provider DOM | All content vars present after mount | 2 |
| Default fallback when snapshot invalid | Client parser tests | 2 |

### Organization snapshot contract

| Check | Description | Wave |
|-------|-------------|------|
| me-access payload schema | organizationBranding + brandingRevision | 2, 4 |
| Kill switch payload | revision 0, default branding | 4 |
| Client `readOrganizationBrandingSnapshot` | null/invalid → default | 2 |

### Raw color / allowlist

| Check | Description | Wave |
|-------|-------------|------|
| No raw `#7c3aed` | Grep + allowlist | 4 partial, 14 strict |
| No raw `#121215` | Content paths | 5+, 14 strict |
| No raw `#09090b` | Content paths | 5+, 14 strict |
| Allowlist file shrinks | PR must reduce or maintain allowlist size | 5+ |

**Planned file:** `scripts/branding-color-allowlist.json`  
**Planned script:** `scripts/branding-parity-check.ts` (Wave 4)

### Visual regression

| Check | Tool | Wave |
|-------|------|------|
| Storybook component diff | Chromatic/Percy/Playwright | 5 warn, 14 block |
| 10 key dashboard pages | Playwright screenshot | 8+, 14 block |
| Default org baseline | Required | 5 |
| Custom org baseline | Staging | 4+ |

### Playwright

| Suite | Wave | Scope |
|-------|------|-------|
| Provider smoke | 2 | Login, CSS var on content root |
| Custom org staging | 4 | Primary color on button |
| Modal a11y | 8 | Escape, focus trap |
| Drawer | 9 | Open/close |
| Pagination | 11 | Next/prev |
| White-label | 14 | Org A → Org B, kill switch |

**Planned path:** `e2e/branding/` (create in Wave 14; smoke tests may start Wave 2)

### Lighthouse

| Check | Wave | Blocking |
|-------|------|----------|
| LCP/CLS/INP on dashboard home | 14 | Yes for production |
| Staging URL | 4+ | Monitor only until 14 |

**Planned:** Extend existing CI or new `branding-lighthouse` job — config TODO Wave 14

### Performance gates

See [performance-benchmarks.md](./performance-benchmarks.md).

| Gate | Wave 14 |
|------|---------|
| me-access ≤ 2 per session | Required |
| LCP ≤ +5% baseline | Required |
| CLS ≤ 0.05 | Required |

### Overlay / z-index

| Check | Wave |
|-------|------|
| `OVERLAY_Z` enum only in overlay files | 7+ |
| Grep ban raw `z-[120]` in new modal code | 8+ |

### Duplicate fetch

| Check | Wave |
|-------|------|
| `fetchMeAccessClient` grep ≤ 2 files (layout + pdf fallback) | 2 |

---

## Screenshot approval flow

1. CI generates visual diff on PR  
2. If diff > 0.5% pixels (default org) → fail unless label `visual-approval`  
3. Reviewer confirms intentional branding change  
4. Custom org diffs require second reviewer (staging baseline)  
5. Wave 14: no manual override for default org regressions  

---

## Existing CI integration

Current repo: `npm run ci` / `npm test` / `npm run build` (see root README).

**Planned additions (TODO — do not create until Wave 4 PR):**

```
.github/workflows/branding-parity.yml   # Wave 4 placeholder
scripts/branding-parity-check.ts        # Wave 4
```

If `.github/workflows/` already exists, extend rather than duplicate.

---

## Wave 4 minimum CI (core gates)

- [ ] `npm test` includes branding parity tests
- [ ] Provider contract test job
- [ ] me-access schema test
- [ ] Allowlist script (non-blocking first merge)

---

## Wave 14 full CI (production gates)

- [ ] All Wave 4 gates strict
- [ ] Allowlist empty or documented exceptions only
- [ ] Storybook visual blocking
- [ ] Playwright white-label suite green
- [ ] Lighthouse blocking on staging
- [ ] Performance benchmark spreadsheet signed off

---

## Rollback in CI

- Revert PR → previous baseline remains in visual tool  
- Kill switch OFF → default org tests must always pass on main  

---

## PR checklist (CI)

- [ ] New tests listed in wave doc pass locally  
- [ ] `npm run ci` green  
- [ ] Allowlist updated if adding temporary hex  
- [ ] Visual diff reviewed (if applicable)  
- [ ] No decrease in contract test coverage  
