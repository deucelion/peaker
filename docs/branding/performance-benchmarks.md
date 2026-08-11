# FAZ 34 — Branding Performance Benchmark Plan

Documentation only. **No benchmark code** in this repository section until implementation waves authorize it.

Reference: [execution-plan.md](./execution-plan.md)

---

## Purpose

Prove the FAZ 34 branding migration does not regress Core Web Vitals, React render cost, or network efficiency.

---

## When to run

| Milestone | Action |
|-----------|--------|
| End of Wave 2 | Capture **before baseline** (provider + SSR) |
| After Wave 4 | Staging benchmark with kill switch ON |
| After Waves 8, 11 | Overlay and table INP checks |
| Wave 14 | Full suite — **blocking** for production sign-off |

---

## Metrics

### React

| Metric | Tool | Baseline (post-W2 target capture) | Target after migration |
|--------|------|-----------------------------------|------------------------|
| Provider render count per navigation | React Profiler | Record | ≤ baseline + 1 (SSR hydrate) |
| Context update count on branding revision | Profiler + counter | N/A until W3 | ≤ 1 content subtree re-render |
| Child re-renders on me-access fetch | Profiler | ~11 page-level effects | 0 (centralized provider) |

### Hydration

| Metric | Tool | Target |
|--------|------|--------|
| Time to branding vars on DOM | Performance mark `branding-vars-applied` | CSR: document flash window; SSR W2: ≤ 50ms post-hydrate |
| Hydration mismatch warnings | Console / CI | 0 |

### Core Web Vitals

| Metric | Tool | Target |
|--------|------|--------|
| LCP | Lighthouse CI / Web Vitals | ≤ +5% vs Wave 2 baseline |
| CLS | Lighthouse | ≤ 0.05 (no shift on theme apply) |
| INP | Web Vitals lab | ≤ +10ms vs baseline (modal open, tab switch) |

### CSS

| Metric | Tool | Target |
|--------|------|--------|
| Computed style recalc scope | DevTools Performance | Theme change scoped to provider subtree |
| CSS variable update count | Manual trace | No full-document invalidation |

### Network

| Metric | Tool | Before | Target (post-W2) |
|--------|------|--------|------------------|
| `/api/me-access` per session | HAR / Playwright | ~14 (page navigation) | ≤ 2 |
| me-access payload size | Response headers | Measure once | No increase |
| Duplicate branding fetches | Network tab | 14 call sites | 1 layout + optional refresh |

### Memory

| Metric | Tool | Target |
|--------|------|--------|
| Provider + snapshot retained | Heap snapshot diff | < 50KB per session increase |

---

## Benchmark scenarios

1. **Cold login → dashboard home** (default org)  
2. **Cold login → dashboard home** (custom org, staging kill switch ON)  
3. **Navigate 5 pages** without full reload (me-access dedupe)  
4. **Open/close Quick Create modal** (after Wave 8)  
5. **Open audit drawer + scroll** (after Wave 9)  
6. **PDF export trigger** (after Wave 12)  
7. **Admin save branding → layout refresh** (after Wave 3)

---

## Before vs after recording template

| Scenario | Metric | Before (date) | After Wave | After (date) | Pass? |
|----------|--------|---------------|------------|--------------|-------|
| Login LCP | ms | | W2 | | |
| 5-page nav me-access count | # | | W2 | | |
| Modal open INP | ms | | W8 | | |
| … | | | | | |

Store results in team spreadsheet or `docs/branding/benchmarks/` (CSV added during Wave 2 implementation — placeholder only).

---

## Deliverables (implementation TODO)

- [ ] `docs/branding/benchmarks/README.md` — protocol summary (Wave 2)
- [ ] Performance mark instrumentation spec (Wave 2 PR)
- [ ] Lighthouse CI config notes in [ci-plan.md](./ci-plan.md) (Wave 14 blocking)
- [ ] Spreadsheet / CSV template for before-after

---

## Gates

| Gate | Wave | Blocking? |
|------|------|-----------|
| Baseline captured | 2 | Yes (before W4 staging flip) |
| Dedupe verified | 2 | Yes |
| INP modal | 8 | Warn |
| Full suite | 14 | **Yes — production** |

---

## Rollback trigger

If after any wave:

- LCP regression > 10% on default org, or  
- INP regression > 25ms on modal open, or  
- me-access calls > 3 per session  

→ Stop merge of next wave; investigate in Wave 2 provider scope before continuing.
