# Wave 1 — Content Token Foundation

**FAZ reference:** 33.1  
**Wave doc:** [../wave-progress.md](../wave-progress.md) · [../execution-plan.md](../execution-plan.md)

---

## Objective

Implement FAZ 33.1 consumption layer: `BrandingUiProvider` skeleton, `UI_CONTENT_THEME_VARS`, selectors, helpers, and class map — **no production DOM binding**.

---

## Scope

- In scope: new `src/lib/ui/branding/*`, unit/contract tests
- Out of scope: globals.css token bind, layout changes, domain component migration

---

## Dependencies

- FAZ 32 `createDefaultBranding`, `BRANDING_COLOR_TOKEN_KEYS`

---

## Blockers

- None (first implementation wave)

---

## Files

### New (planned)

- `src/lib/ui/branding/UI_CONTENT_THEME_VARS.ts`
- `src/lib/ui/branding/uiBrandingSelectors.ts`
- `src/lib/ui/branding/uiBrandingClasses.ts`
- `src/lib/ui/branding/uiBrandingHelpers.ts`
- `src/lib/ui/branding/BrandingUiContext.tsx`
- `src/lib/ui/branding/BrandingUiProvider.tsx`
- `src/lib/ui/branding/index.ts`
- `src/lib/ui/branding/*.test.ts`

### Modified

- None required (optional: commented placeholders in globals deferred to Wave 5)

---

## Validation

- [ ] Selector output matches default theme snapshot
- [ ] All canonical color keys have content var mapping
- [ ] Provider renders in isolation test without throwing
- [ ] No import of `getOrganizationBranding` in client branding module

---

## Rollback

Delete `src/lib/ui/branding/` directory; no runtime impact.

---

## Risks

| Risk | Level |
|------|-------|
| Dead code until Wave 2 | Low |

---

## Testing

| Type | Planned |
|------|---------|
| Unit | Selector matrices (default, custom, invalid) |
| Contract | Token key completeness |
| Integration | Provider mount in test harness |
| Playwright | None |
| Visual | None |

---

## Expected Outcome

Mergeable foundation; unblocks Waves 2–14.

**Coverage increase:** +0% visible

---

## Estimated LOC

~450–650 (incl. tests)

---

## Estimated Duration

3–5 days

---

## PR Checklist

- [ ] Wave doc TODOs updated
- [ ] [wave-progress.md](../wave-progress.md) Wave 1 section
- [ ] [governance.md](../governance.md) PR checklist
- [ ] No production behavior change
- [ ] `npm test` green

---

## Implementation TODO

### Foundation

- [ ] Define `UI_CONTENT_THEME_CSS_VAR_PREFIX` (`--peaker-ui-`)
- [ ] Map all `BRANDING_COLOR_TOKEN_KEYS` to content vars
- [ ] Implement core selectors (surface, primary, border, text)
- [ ] Implement `uiBrandingClasses` map
- [ ] Implement `BrandingUiProvider` (accept snapshot props; no fetch)
- [ ] Export public API from `index.ts`

### Tests

- [ ] Selector default parity with `createDefaultBranding()`
- [ ] Custom primary `#112233` selector output
- [ ] Invalid snapshot → default helpers

### Documentation

- [ ] Link from [README.md](../README.md) to this wave on merge

---

## Implementation notes

<!-- Leave empty until PR; append learnings here -->
