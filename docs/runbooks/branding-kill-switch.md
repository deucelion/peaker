# Branding Kill Switch Runbook

**FAZ 34 Wave 4** — operational guide for `PEAKER_ORG_BRANDING`  
**Scope:** staging enablement and production rollout procedure (production flip only after Wave 14 sign-off)

---

## Overview

| Variable | Default | Effect when OFF | Effect when ON |
|----------|---------|-----------------|----------------|
| `PEAKER_ORG_BRANDING` | unset / OFF | Peaker default branding, revision `0`, no DB branding reads | DB-backed organization branding via runtime pipeline |

Kill switch is implemented in:

- `src/lib/organization/branding/runtime/killSwitch.ts`
- `src/lib/organization/branding/runtime/getOrganizationBranding.ts`
- `src/lib/organization/branding/runtime/brandingMeAccessPayload.ts`

---

## Enabling branding (staging)

1. Confirm Waves 1–4 are deployed on staging.
2. Configure a test organization branding via super-admin:
   - `/super-admin/[organizationId]/branding`
   - Requires `super_admin` role (Wave 3 admin UI).
3. Set environment variable on staging:

```bash
PEAKER_ORG_BRANDING=1
```

Accepted truthy values: `1`, `true`, `yes`, `on` (case-insensitive, trimmed).

4. Redeploy or restart staging runtime so the env var is picked up.
5. Verify (see Staging verification below).

**Do not enable on production until Wave 14 production readiness gates pass.**

---

## Rollback

Immediate rollback — no code deploy required:

```bash
# Unset or disable
unset PEAKER_ORG_BRANDING
# or
PEAKER_ORG_BRANDING=0
```

Then restart staging/production runtime.

Effect:

- All tenants receive Peaker default branding (`createDefaultBranding()`).
- me-access returns `brandingRevision: 0`.
- No DB writes required for rollback.
- Process/request caches naturally repopulate with default on next request.

If bad branding data was saved to DB while kill switch was ON, revert via admin UI (increment revision) or keep kill switch OFF until data is corrected.

---

## Staging verification

### 1. Kill switch OFF (baseline)

With `PEAKER_ORG_BRANDING` unset:

- [ ] Dashboard loads with default Peaker purple (`#7c3aed` primary in layout/shell).
- [ ] me-access payload: `brandingRevision === 0`, default theme tokens.
- [ ] No custom org colors visible for test org with saved DB branding.
- [ ] `npm run branding:parity` passes locally/CI.

### 2. Kill switch ON (custom org)

With `PEAKER_ORG_BRANDING=1`:

- [ ] Log in as user in test org with custom branding saved via admin UI.
- [ ] me-access returns updated `brandingRevision` (> 0 after save).
- [ ] `--peaker-ui-*` CSS vars on content root reflect saved theme (Wave 2 provider).
- [ ] Layout/sidebar shell behavior unchanged (layout freeze preserved).
- [ ] Save branding in admin UI → reload → revision increments; conflict UI on stale revision.

### 3. CI parity

On every PR/main:

```bash
npm run branding:parity
```

Core gates (blocking):

- Kill switch defaults OFF
- Default token parity
- Layout + content theme parity
- Selector matrix snapshot
- Provider contract
- me-access payload contract

Raw hex allowlist: **warn-only** until Wave 14.

---

## Production rollout procedure

**Gate:** Wave 14 complete — all production readiness gates in `docs/branding/execution-plan.md`.

1. Ops + platform sign-off on Wave 14 checklist.
2. Run rollback drill on staging (unset env, confirm instant default).
3. Enable on production in phased rollout:
   - Phase A: internal/test org only (if supported by env targeting) OR single pilot org.
   - Phase B: expand org-by-org after 24–48h monitoring.
   - Phase C: global `PEAKER_ORG_BRANDING=1` when all orgs validated.
4. Monitor:
   - me-access latency and error rate
   - Branding runtime metrics (`branding_kill_switch`, `branding_database`, cache hits)
   - User-reported visual regressions
5. Keep rollback runbook accessible; on-call can unset env without redeploy.

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Custom colors not appearing on staging | Kill switch OFF | Set `PEAKER_ORG_BRANDING=1`, restart |
| Custom colors not appearing with env ON | Cache stale | Save branding again (revision bump) or restart process |
| me-access still shows revision 0 with env ON | Wrong env on instance | Verify env on running container/host |
| Revision conflict on save | Concurrent edit | Use "Reload" in admin UI, re-apply changes |
| Default Peaker colors after save | Kill switch OFF or parse fallback | Check env; inspect DB branding JSON validity |
| CI parity fails on main | Token/snapshot drift | Run `npm run branding:parity`; fix defaults or update snapshot intentionally via wave PR |
| Raw hex allowlist warning | New file with hardcoded brand color | Add to allowlist temporarily (Wave 4–13) or migrate in scheduled surface wave |

### Useful commands

```bash
# Local parity gates
npm run branding:parity

# Wave 4 parity unit tests
npm test -- src/lib/ui/branding/contentThemeParity.test.ts \
  src/lib/ui/branding/brandingProviderContract.test.ts \
  src/lib/organization/branding/runtime/killSwitch.test.ts \
  src/lib/organization/branding/runtime/brandingMeAccessContract.test.ts

# Full CI
npm run ci
```

### Related docs

- `docs/branding/wave-04.md` — Wave 4 scope
- `docs/branding/ci-plan.md` — CI gate definitions
- `docs/branding/governance.md` — token governance and rollback policy
- `docs/branding/execution-plan.md` — production readiness gates (Wave 14)

---

## Ops checklist (staging flip)

- [ ] Wave 3 admin UI accessible for super_admin
- [ ] Test org branding saved via admin (not SQL)
- [ ] `PEAKER_ORG_BRANDING=1` set on staging only
- [ ] Staging verification checklist completed
- [ ] Rollback tested (unset env → default within one request cycle)
- [ ] Date of staging flip recorded in PR/deploy notes
