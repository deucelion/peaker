# Peaker — FAZ 34 Branding Implementation

Execution planning and governance documentation for the organization branding consumption migration.

**Status:** Planning only — no implementation in this folder implies production code changes.

## Source of truth

- [Execution Plan (master roadmap)](./execution-plan.md) — FAZ 34.0 Revised Branding Implementation Execution Plan
- Derived from: FAZ 32 (runtime platform), FAZ 33.1–33.3 (consumption analyses), FAZ 34.0 revision

## Document index

| Document | Purpose |
|----------|---------|
| [execution-plan.md](./execution-plan.md) | Dependency graph, critical path, schedule, merge/release order, production gates |
| [governance.md](./governance.md) | Token ownership, namespaces, CI, allowlist, deprecation |
| [performance-benchmarks.md](./performance-benchmarks.md) | Performance validation protocol (no benchmark code) |
| [storybook-plan.md](./storybook-plan.md) | Visual catalog coverage plan |
| [ci-plan.md](./ci-plan.md) | CI gates, parity, visual regression, Playwright, Lighthouse |
| [wave-progress.md](./wave-progress.md) | Checklist tracker for Waves 1–14 |
| [wave-01.md](./wave-01.md) … [wave-14.md](./wave-14.md) | Per-wave execution specs |

## Wave overview (14 waves)

| Wave | Title |
|------|--------|
| 1 | Content Token Foundation |
| 2 | Provider Stack |
| 3 | Branding Admin UI |
| 4 | Kill Switch Staging + Core Parity CI |
| 5 | Primary Surfaces (Globals → Components) |
| 6 | Form Surfaces |
| 7 | Overlay Primitives Foundation |
| 8 | Modal Migration |
| 9 | Drawer/Sheet Migration + Offline Consolidation |
| 10 | Floating UI & Navigation |
| 11 | Tables Complete |
| 12 | Charts & Export Branding |
| 13 | Empty / Loading / KPI + Legacy Deprecation |
| 14 | White-Label Validation & Full CI Gates |

## Baseline (repository at planning time)

- Shell branding coverage: ~5–8%
- `#7c3aed` matches: ~648 repo-wide
- `BrandingUiProvider`: not present
- `fetchMeAccessClient` call sites: ~14
- Kill switch (`PEAKER_ORG_BRANDING`): OFF by default

## Rules for implementers

1. Do not change FAZ 32 runtime architecture without ADR.
2. Content UI uses `--peaker-ui-*`; shell uses layout/sidebar namespaces (layout freeze).
3. Semantic colors (success, error, warning, finance status) remain frozen.
4. Each wave PR must update [wave-progress.md](./wave-progress.md) and relevant wave doc TODOs.
5. Storybook and CI requirements from [governance.md](./governance.md) apply from Wave 5 onward.

## Related existing docs

- [docs/production-runbook.md](../production-runbook.md) — deploy and env vars
- FAZ 32 persistence: `supabase/migrations/20260730_faz32_organization_branding.sql`
