# Wave 3 — Branding Admin UI

**FAZ reference:** 33.4.3 (moved early)  
**Wave doc:** [../wave-progress.md](../wave-progress.md)

---

## Objective

Super-admin organization branding editor: theme tokens, revision write via `saveOrganizationBranding`; enable QA/design without SQL.

---

## Scope

- In scope: admin route, editor UI, server action, cache invalidation on save
- Out of scope: asset upload CDN, logo binary upload (future)

---

## Dependencies

- **Wave 2** (provider reflects saved theme)

---

## Blockers

- Authz review: super_admin only
- Wave 2 merged

---

## Files

### New (planned)

- `src/app/(dashboard)/super-admin/[organizationId]/branding/page.tsx`
- `src/app/(dashboard)/super-admin/_components/OrgBrandingEditor.tsx`
- `src/lib/actions/organizationBrandingActions.ts`

### Modified (planned)

- `src/app/(dashboard)/super-admin/[organizationId]/page.tsx` (link to branding)

---

## Validation

- [ ] Save increments `branding_revision`
- [ ] Invalid colors rejected by `validateBranding`
- [ ] Revision conflict handled in UI
- [ ] After save + reload, layout shows new primary (staging, kill switch ON)
- [ ] Non–super-admin cannot access route

---

## Rollback

Hide route behind feature flag; no DB writes.

---

## Risks

| Risk | Level |
|------|-------|
| Unauthorized write | Medium |
| Bad theme breaks contrast | Medium |

---

## Testing

| Type | Planned |
|------|---------|
| Unit | Validation, action error paths |
| Integration | Save + read roundtrip |
| Playwright | Edit primary → reload layout |

---

## Expected Outcome

Operational white-label testing for Waves 4–13.

**Coverage increase:** Enables custom-org QA (0% automatic)

---

## Estimated LOC

~500–800

---

## Estimated Duration

5–7 days

---

## PR Checklist

- [ ] Super_admin authz verified
- [ ] Staging-only note in PR if not production-ready
- [ ] Runbook link for test org setup

---

## Implementation TODO

- [ ] Editor form for theme color tokens
- [ ] Server action calling `saveOrganizationBranding`
- [ ] Process cache invalidation on success
- [ ] Success/error UI with revision display
- [ ] Link from org admin page

---

## Implementation notes

<!-- Append after PR -->
