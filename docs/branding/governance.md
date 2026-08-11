# FAZ 34 — Branding Design Token Governance

Planning document for token ownership, CI enforcement, and deprecation during the FAZ 34 migration.

**No implementation in this document.**

---

## Token ownership

| Layer | Owner path | Responsibility |
|-------|------------|----------------|
| Server canonical tokens | `src/lib/organization/branding/tokens.ts` | `BRANDING_COLOR_TOKEN_KEYS`, schema |
| Server default theme | `src/lib/organization/branding/defaults.ts` | `createDefaultBranding()` |
| Shell layout vars | `src/lib/navigation/layoutThemeTokens.ts` | `--peaker-layout-theme-*` (layout freeze) |
| Shell sidebar vars | `src/lib/navigation/sidebarThemeTokens.ts` | `--peaker-sidebar-theme-*` (layout freeze) |
| Content consumption | `src/lib/ui/branding/` (Wave 1+) | `--peaker-ui-*`, selectors, provider |
| Overlay selectors | `src/lib/ui/branding/overlaySelectors.ts` (Wave 7+) | Overlay-specific content tokens |
| Global CSS classes | `src/app/(dashboard)/globals.css` | `ui-*` classes bound to content vars |
| Semantic colors | Frozen list (below) | Not org-brandable |

Changes to canonical token keys require ADR + migration note in wave doc.

---

## Namespace rules

| Namespace | CSS prefix | Used by | Rule |
|-----------|------------|---------|------|
| Content | `--peaker-ui-*` | Dashboard content, forms, tables, overlays | **Default for all new UI** |
| Layout shell | `--peaker-layout-theme-*` | Main background, header chrome in layout | Layout freeze — extend only via ADR |
| Sidebar shell | `--peaker-sidebar-theme-*` | Sidebar nav, logo shell | Layout freeze — extend only via ADR |

**Forbidden:** Fourth namespace without ADR. Content components must not read sidebar/layout vars directly (use content selectors).

---

## Semantic color freeze

These colors are **not** org-brandable. New usages must use semantic tokens/classes, not `--peaker-ui-PRIMARY`.

| Category | Examples | Components |
|----------|----------|------------|
| Success | emerald-* | `ui-badge-success`, EmptyState onboarding, finance collected |
| Warning | amber-* | permission, overdue, capacity warning |
| Error / danger | red-* | `ui-btn-danger`, EmptyState error, InlineErrorState |
| Finance status | emerald/amber receivable | KPI semantic tones, payment status badges |
| Ops severity | amber/red/skull | sistem-operasyonlari alerts |
| Offline toast | emerald/amber | `OfflineActionToast` interior |
| Chart data ink | ACWR zones, wellness traffic | Series colors in charts |

Branded **shell** around semantic content is allowed (e.g. toast border uses content surface; interior stays semantic).

---

## No new hardcoded colors

During FAZ 34 migration:

- **Prohibited** in `src/components/**` and `src/app/(dashboard)/**`: new `#7c3aed`, `#121215`, `#09090b`, `#6d28d9`, `#c4b5fd`, `#101013`, `#17171d` (except allowlist file).
- **Prohibited** in new `globals.css` `@layer components` rules: raw hex (must use `var(--peaker-ui-*)`).

Existing hardcoded colors are removed wave-by-wave; allowlist shrinks each merge.

---

## No new ui-* class variants

- New `ui-*` classes in `globals.css` require token bind in the **same PR**.
- PR checklist: "Does this add ui-* without `--peaker-ui-*`?" → block merge from Wave 5 onward.
- Prefer extending existing `ui-btn`, `ui-card`, etc. before creating `ui-btn-secondary-v2`.

---

## Token lifecycle

```
1. Proposal (PR description + wave doc reference)
2. Review (design + platform eng)
3. Add server key if needed (BRANDING_COLOR_TOKEN_KEYS + validation)
4. Add UI_CONTENT_THEME_VARS + selector + optional ui-* class
5. Storybook story (from Wave 5)
6. CI allowlist update
7. Domain adoption in scheduled wave
8. Remove from raw color allowlist
```

---

## Deprecation policy

| Artifact | Wave | Action |
|----------|------|--------|
| `EmptyStateCard` | 13 | Redirect to `EmptyState`; delete after one release |
| `PendingActionsDrawer` | 9 | Delete; `SyncStatusCenter` only |
| Dead `LAYOUT_THEME_VARS.SIDEBAR_*` | 2 | Remove unused layout namespace keys |
| Inline modal shells | 8–9 | Replace with overlay primitives |
| Inline `<table>` shells | 11 | Adopt `DataTable` |
| `chartTooltipStyle` hardcoded hex | 10–12 | Move to selector |
| `pdfCommon.BRAND_COLOR` | 12 | Snapshot primary |

Deprecated items get `@deprecated` JSDoc in the deprecation wave; removal in following release if safe.

---

## Storybook requirements

From **Wave 5** onward, any PR that changes a branded primitive must:

- [ ] Add or update Storybook story under planned catalog ([storybook-plan.md](./storybook-plan.md))
- [ ] Include **default org** and **custom org** (primary `#112233` or staging test org) variants
- [ ] Document semantic variants separately (not recolored to org primary)

Storybook is not optional for: buttons, inputs, cards, tables, overlays, tabs, empty/loading (per wave docs).

---

## CI requirements

See [ci-plan.md](./ci-plan.md). Summary:

| Phase | Gates |
|-------|--------|
| Wave 4+ | Token parity, provider contract, me-access schema |
| Wave 5+ | No new raw hex in touched files; Storybook visual warn |
| Wave 14 | Full allowlist empty; Lighthouse blocking; E2E white-label |

---

## Raw color policy

### Allowlist strategy

- File (planned): `scripts/branding-color-allowlist.json`
- Lists file paths permitted to contain raw hex during migration
- **Shrinks** each wave until empty at Wave 14
- CI: grep for `#7c3aed|#121215|#09090b|#6d28d9` fails if match outside allowlist

### ESLint rule proposal (planning)

- Rule name (proposed): `peaker/no-hardcoded-brand-colors`
- Scope: `src/components/**`, `src/app/(dashboard)/**`
- Allow: allowlist import, semantic class names, test fixtures

### Stylelint rule proposal (planning)

- Scope: `src/app/(dashboard)/globals.css`
- Require `var(--peaker-ui-*)` for color/background/border in `@layer components` (new rules only from Wave 5)

---

## Rollback (governance)

| Action | Effect |
|--------|--------|
| Unset `PEAKER_ORG_BRANDING` | Instant default branding (FAZ 32) |
| Revert wave PR | Restore prior allowlist entry for touched files |
| DB branding bad data | Admin UI revert + revision increment; or kill switch OFF |

Runbook detail: planned `docs/branding/runbooks/kill-switch.md` (create in Wave 4).

---

## PR checklist (every branding wave)

- [ ] Wave doc updated (TODO sections marked done)
- [ ] [wave-progress.md](./wave-progress.md) updated
- [ ] No new hardcoded colors outside allowlist
- [ ] Semantic colors unchanged (screenshot if near semantic code)
- [ ] Storybook updated (W5+)
- [ ] Tests listed in wave doc executed
- [ ] Rollback steps documented in PR description
