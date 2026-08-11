# FAZ 34 — Branding Performance Benchmarks

Wave 14 production sign-off results and protocol summary.

Reference: [../performance-benchmarks.md](../performance-benchmarks.md)

---

## Status

| Milestone | Status |
|-----------|--------|
| Wave 2 baseline captured | Complete |
| Wave 4 staging kill switch | Complete |
| Waves 8 / 11 overlay + table checks | Complete |
| Wave 14 full suite (blocking) | **Signed off** |

---

## Results

Production validation results are recorded in [wave14-results.csv](./wave14-results.csv).

| Gate | Target | Wave 14 result |
|------|--------|----------------|
| me-access per session | ≤ 2 | **PASS** (2: layout provider + export fallbacks) |
| LCP vs baseline | ≤ +5% | **PASS** |
| CLS | ≤ 0.05 | **PASS** |
| INP modal open | ≤ +10ms | **PASS** |
| Cumulative surface coverage | 50–60% | **PASS** (54% documented) |

---

## How to re-run

### Unit / CI gates

```bash
npm run branding:validate
npm run branding:parity:strict
```

### E2E white-label (requires `.env.e2e` credentials)

```bash
PLAYWRIGHT_START_SERVER=1 npm run test:e2e:branding
```

### Lighthouse (staging URL required)

```bash
LIGHTHOUSE_URL=https://staging.example.com npm run branding:lighthouse
```

### Storybook visual catalog

```bash
npm run build-storybook
STORYBOOK_URL=http://127.0.0.1:6006 npm run test:e2e:branding:visual
```

---

## Rollback trigger

Stop production rollout if:

- LCP regression > 10% on default org
- INP regression > 25ms on modal open
- me-access calls > 3 per session

See [../runbooks/production-rollout.md](../runbooks/production-rollout.md).
