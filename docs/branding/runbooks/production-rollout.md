# FAZ 34 Wave 14 — Production Branding Rollout

**Status:** Approved for phased production enablement after Wave 14 CI gates pass.

References:

- [branding-kill-switch.md](../../runbooks/branding-kill-switch.md)
- [../benchmarks/README.md](../benchmarks/README.md)
- [../ci-plan.md](../ci-plan.md)

---

## Pre-flight checklist

- [x] Waves 1–13 merged and validated
- [x] Wave 14 CI strict allowlist green
- [x] Storybook catalog complete (13 wave story files)
- [x] E2E white-label + kill-switch suites present
- [x] Performance benchmarks signed off (`wave14-results.csv`)
- [ ] Stakeholder executive sign-off (fill before production flip)

---

## Phased production enablement

### Phase 0 — Default parity (current)

`PEAKER_ORG_BRANDING` unset. All tenants receive Peaker default branding.

Verify:

```bash
npm run branding:validate
npm run branding:parity:strict
```

### Phase 1 — Pilot org (staging → production)

1. Select one pilot organization with saved branding in super-admin.
2. Enable on **staging** first:

```bash
PEAKER_ORG_BRANDING=1
```

3. Run E2E white-label suite against staging credentials.
4. Enable on **production** for pilot org only (same env var — global flag).
5. Monitor for 72 hours:
   - me-access error rate
   - LCP / CLS on dashboard home
   - Support tickets mentioning theme/colors

### Phase 2 — General availability

After pilot success:

1. Announce custom branding availability to all organizations.
2. Keep kill switch documented for instant rollback.
3. Continue strict CI on all main-branch merges.

---

## Rollback procedure

Immediate — no deploy required:

```bash
unset PEAKER_ORG_BRANDING
# or
PEAKER_ORG_BRANDING=0
```

Restart application runtime.

Effects:

- All tenants revert to `createDefaultBranding()` immediately.
- me-access returns `brandingRevision: 0`.
- No database migration rollback required.

If incorrect branding was saved while flag was ON, correct via super-admin editor or keep kill switch OFF until data is fixed.

---

## Rollback drill (required once before Phase 2)

1. Enable `PEAKER_ORG_BRANDING=1` on staging.
2. Confirm custom org colors visible on dashboard content root.
3. Set `PEAKER_ORG_BRANDING=0` and restart.
4. Confirm default `#7c3aed` primary restored within one page load.
5. Record drill date in release notes.

---

## Monitoring

| Signal | Threshold | Action |
|--------|-----------|--------|
| LCP regression | > +10% vs baseline | Pause rollout, investigate provider |
| CLS | > 0.05 | Pause rollout |
| me-access 5xx | Any sustained spike | Rollback kill switch OFF |
| Branding revision mismatch | Client stale > 5 min | Force refresh via layout remount |

---

## CI gates (must stay green post-release)

| Gate | Command |
|------|---------|
| Strict parity | `npm run branding:parity:strict` |
| Wave 14 validation | `npm run branding:validate` |
| Full CI | `npm run ci` |
| E2E branding | `PLAYWRIGHT_START_SERVER=1 npm run test:e2e:branding` |

---

## Executive sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | [ ] |
| Product | | | [ ] |
| Operations | | | [ ] |

---

## Wave 14 completion

This runbook satisfies Wave 14 production kill switch runbook sign-off requirement.
Do **not** enable production branding until executive sign-off row is checked.
