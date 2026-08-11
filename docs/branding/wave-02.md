# Wave 2 — Provider Stack

**FAZ reference:** 33.3.2, 33.3.1, 33.4.2 (partial)  
**Wave doc:** [../wave-progress.md](../wave-progress.md)

---

## Objective

Single client branding gateway: request cache on me-access, mount provider in dashboard layout, SSR initial snapshot, eliminate duplicate fetches, remove dead layout namespace keys.

---

## Scope

- In scope: me-access cache, layout provider, SSR bootstrap, ~12 page dedupe, layout token cleanup
- Out of scope: globals.css bind, admin UI, kill switch env flip

---

## Dependencies

- **Wave 1** merged

---

## Blockers

- Wave 1

---

## Files

### Modified (planned)

- `src/app/api/me-access/route.ts`
- `src/lib/auth/meAccessBootstrap.ts`
- `src/app/(dashboard)/layout.tsx`
- `src/lib/auth/meAccessClient.ts`
- `src/lib/navigation/layoutThemeTokens.ts`
- ~12 pages with redundant `fetchMeAccessClient` (features only)

### New (planned)

- `src/lib/auth/MeAccessProvider.tsx` or extended `BrandingUiProvider`
- `src/lib/auth/meAccessServer.ts`
- `src/lib/auth/useMeAccess.ts`

---

## Validation

- [ ] One me-access fetch per session (layout mount)
- [ ] No hydration mismatch warnings
- [ ] `--peaker-ui-*` present on content root after load
- [ ] Layout/sidebar shell behavior unchanged
- [ ] Performance baseline captured ([performance-benchmarks.md](../performance-benchmarks.md))

---

## Rollback

- Env `PEAKER_SSR_BRANDING=0` → client-only path
- Revert layout to pre-Wave-2 state

---

## Risks

| Risk | Level |
|------|-------|
| SSR/hydration mismatch | **High** |
| Layout critical path regression | **High** |

---

## Testing

| Type | Planned |
|------|---------|
| Unit | Request cache, context, client parser |
| Integration | me-access call count mock |
| Playwright | Login; computed `--peaker-ui-PRIMARY` |
| Performance | Baseline capture |

---

## Expected Outcome

Architecture ready for consumption; FOUC reduced when SSR enabled.

**Coverage increase:** +0–2%

---

## Estimated LOC

~700–1,000

---

## Estimated Duration

7–10 days

---

## PR Checklist

- [ ] [ci-plan.md](../ci-plan.md) provider contract tests
- [ ] [performance-benchmarks.md](../performance-benchmarks.md) baseline recorded
- [ ] Duplicate fetch grep ≤ 2 files
- [ ] No `getOrganizationBranding` in client components

---

## Implementation TODO

### Runtime

- [ ] Wrap me-access route with `runWithOrganizationBrandingRequestCacheAsync`
- [ ] Wire features request cache symmetrically
- [ ] Server-side branding slice for layout initial props
- [ ] Mount provider; inject content CSS vars on content root
- [ ] Remove dead `LAYOUT_THEME_VARS.SIDEBAR_*` usage if unused

### Dedupe

- [ ] Replace page-level `fetchMeAccessClient` with `useMeAccess()` on listed pages
- [ ] PDF/email loaders: context-first, fetch fallback

### Tests

- [ ] Provider contract tests
- [ ] me-access schema test
- [ ] Hydration test (if applicable)

---

## Implementation notes

<!-- Append after PR -->
