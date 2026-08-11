# FAZ 34.0 — Branding Implementation Execution Plan (Master Roadmap)

**Version:** Revised (14 waves)  
**Mode:** Planning document — single source of truth for FAZ 34 execution  
**Architecture:** Preserves FAZ 32 runtime and FAZ 33 consumption design; no architectural changes in this doc

---

## Executive summary

| Dimension | Estimate |
|-----------|----------|
| Total waves | 14 independently mergeable PRs |
| Total LOC | ~5,500–8,500 (incl. tests) |
| Sequential critical path | ~12–16 weeks (1 engineer) |
| Parallel (3 engineers, post-W4) | ~7–9 weeks |
| Coverage trajectory | 5–8% → ~20% (W5) → ~35% (W11) → **50–60%** verified (W14) |
| Duplicate fetch reduction | ~14 → ≤2 me-access calls per session |
| Duplicate code reduction | ~800–1,200 LOC (modals, tables, tabs, empty) |
| White-label readiness | Admin W3; staging real branding W4; production gate W14 |

### Critical path

**W1 → W2 → W3 → W4 → W5 → W7 → W8 → W11 → W14**

### Highest operational risks

1. Wave 2 — SSR/hydration / FOUC  
2. Wave 4 — Kill switch before parity CI  
3. Wave 8 — Modal z-index vs offline layer  
4. Wave 11 — Responsive table regression  
5. Wave 14 — Production sign-off before performance gates pass  

---

## Dependency graph

```
W1 Tokens
  └─ W2 Provider Stack
       ├─ W3 Admin UI
       │    └─ W4 Kill Switch Staging + Core CI
       │         └─ W5 Primary (globals→components)
       │              ├─ W6 Forms
       │              ├─ W11 Tables
       │              └─ W13 Empty/KPI
       └─ W7 Overlay Primitives
            ├─ W8 Modals
            ├─ W9 Drawers/Sheets
            └─ W10 Menu/Tooltip/Nav
                 └─ W12 Charts & PDF
                      └─ W14 Validation (all paths converge)
```

---

## Parallel execution tracks

| Track | Waves | Focus |
|-------|-------|--------|
| **A — Platform** | W1 → W2 → W3 → W4 | Runtime consumption, admin, CI |
| **B — Surfaces** | W5 → W6 → W11 → W13 | CSS, forms, tables, empty states |
| **C — Overlay/Nav** | W7 → W8 → W9 → W10 | Modals, drawers, menus, tabs |
| **D — Analytics/Export** | W12 | Charts, PDF (after W10) |
| **E — Quality** | Continuous + W14 | Benchmarks, Storybook, E2E |

Tracks B and C start after **Wave 4** (staging kill switch ON). Track D after **Wave 10**.

---

## Merge order (strict)

| Order | Wave | PR title (suggested) |
|-------|------|---------------------|
| 1 | 1 | `feat(branding): FAZ 34 W1 content token foundation` |
| 2 | 2 | `feat(branding): FAZ 34 W2 provider stack` |
| 3 | 3 | `feat(branding): FAZ 34 W3 admin UI` |
| 4 | 4 | `chore(branding): FAZ 34 W4 kill switch staging + core CI` |
| 5 | 5 | `feat(branding): FAZ 34 W5 primary surfaces` |
| 6 | 6 | `feat(branding): FAZ 34 W6 form surfaces` |
| 7 | 7 | `feat(branding): FAZ 34 W7 overlay primitives` |
| 8 | 8 | `feat(branding): FAZ 34 W8 modal migration` |
| 9 | 9 | `feat(branding): FAZ 34 W9 drawer/sheet migration` |
| 10 | 10 | `feat(branding): FAZ 34 W10 floating UI and navigation` |
| 11 | 11 | `feat(branding): FAZ 34 W11 tables complete` |
| 12 | 12 | `feat(branding): FAZ 34 W12 charts and export branding` |
| 13 | 13 | `feat(branding): FAZ 34 W13 empty loading KPI` |
| 14 | 14 | `test(branding): FAZ 34 W14 white-label validation and full CI` |

Each PR must be independently mergeable: green CI, no dependency on unreleased follow-up except where noted in wave docs.

---

## Release order

| Environment | After wave | Action |
|-------------|------------|--------|
| Local dev | W1+ | Optional; no env change |
| Staging | W4 | `PEAKER_ORG_BRANDING=1`; custom org via W3 admin |
| Staging | W5–13 | Incremental visual validation |
| Production | **W14 only** | Kill switch rollout per [governance.md](./governance.md) runbook |

---

## Production readiness gates

All must pass before production `PEAKER_ORG_BRANDING=1`:

| Gate | Document |
|------|----------|
| Token parity (default org) | [ci-plan.md](./ci-plan.md) |
| Provider + me-access contract | [ci-plan.md](./ci-plan.md) |
| Visual regression (Storybook + key pages) | [storybook-plan.md](./storybook-plan.md) |
| Performance benchmarks | [performance-benchmarks.md](./performance-benchmarks.md) |
| White-label E2E | Wave 14 |
| Rollback drill | [governance.md](./governance.md) |
| wave-progress.md Wave 14 complete | [wave-progress.md](./wave-progress.md) |

---

## Key planning decisions (preserved from FAZ 34.0 revision)

### Globals before components (Wave 5)

Tokenize `globals.css` **before** component migration to avoid double-touch and minimize visual regression. See [wave-05.md](./wave-05.md).

### Overlay strategy: primitive-first

Foundation → Modal → Drawer/Sheet → Menu/Tooltip/Nav — not domain batches. See [wave-07.md](./wave-07.md) through [wave-10.md](./wave-10.md).

### Admin and kill switch early

Wave 3 (admin) and Wave 4 (staging kill switch) enable QA/design without SQL. Previously deferred to late waves.

---

## Estimated schedule

| Phase | Waves | Duration (1 eng) | Duration (3 eng parallel) |
|-------|-------|------------------|---------------------------|
| Foundation | W1–W2 | 2–3 weeks | 1.5–2 weeks |
| Platform ops | W3–W4 | 1–1.5 weeks | 1 week |
| Core surfaces | W5–W6 | 1–1.5 weeks | 1 week |
| Overlays | W7–W10 | 3–4 weeks | 2–2.5 weeks |
| Data & analytics | W11–W13 | 2.5–3.5 weeks | 1.5–2 weeks |
| Validation | W14 | 1–1.5 weeks | 1 week |
| **Total** | W1–W14 | **~12–16 weeks** | **~7–9 weeks** |

---

## Wave index

| Wave | Document |
|------|----------|
| 1 | [wave-01.md](./wave-01.md) |
| 2 | [wave-02.md](./wave-02.md) |
| 3 | [wave-03.md](./wave-03.md) |
| 4 | [wave-04.md](./wave-04.md) |
| 5 | [wave-05.md](./wave-05.md) |
| 6 | [wave-06.md](./wave-06.md) |
| 7 | [wave-07.md](./wave-07.md) |
| 8 | [wave-08.md](./wave-08.md) |
| 9 | [wave-09.md](./wave-09.md) |
| 10 | [wave-10.md](./wave-10.md) |
| 11 | [wave-11.md](./wave-11.md) |
| 12 | [wave-12.md](./wave-12.md) |
| 13 | [wave-13.md](./wave-13.md) |
| 14 | [wave-14.md](./wave-14.md) |

---

## Supporting documents

- [governance.md](./governance.md)
- [performance-benchmarks.md](./performance-benchmarks.md)
- [storybook-plan.md](./storybook-plan.md)
- [ci-plan.md](./ci-plan.md)
- [wave-progress.md](./wave-progress.md)

---

## FAZ 34.1 backlog (post-W14)

- Auth/login page branding  
- Layout freeze expansion (product ADR)  
- Raw hex burn-down final ~50 → 0  
- Logo/mark/favicon CDN URL resolution  
- Dark/light theme (if product adds)
