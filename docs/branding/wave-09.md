# Wave 9 — Drawer/Sheet Migration + Offline Consolidation

**FAZ reference:** 33.2c drawer/sheet  
**Wave doc:** [../wave-progress.md](../wave-progress.md)

---

## Objective

Migrate all drawer/sheet surfaces; delete `PendingActionsDrawer` in favor of `SyncStatusCenter` only.

---

## Scope

- Finance filter drawer, tahsilat sheet, audit detail drawer, sync status center
- Remove duplicate offline drawer

---

## Dependencies

- **Wave 7**, **Wave 8** (z-index proven)

---

## Blockers

- Wave 8 merged

---

## Files

### Modified (planned)

- `src/components/finance/FinanceFilterDrawer.tsx`
- `src/components/finance/TahsilatRecordSheet.tsx`
- `src/app/(dashboard)/audit-log/page.tsx` (`AuditDetailDrawer`)
- `src/components/offline/SyncStatusCenter.tsx`
- `src/components/offline/index.ts`

### Deleted (planned)

- `src/components/offline/PendingActionsDrawer.tsx`

---

## Validation

- [ ] Offline drawer UX parity checklist
- [ ] Responsive bottom/right sheet
- [ ] No references to PendingActionsDrawer

---

## Rollback

Restore PendingActionsDrawer if needed; revert drawer files.

---

## Risks

| Risk | Level |
|------|-------|
| Offline UX regression | **High** |

---

## Testing

| Type | Planned |
|------|---------|
| Playwright | Offline drawer open/close |
| Visual | Audit drawer mobile/desktop |

---

## Expected Outcome

Single offline drawer codepath.

**Coverage increase:** +4–6%

---

## Estimated LOC

~400–600 net (includes deletions)

---

## Estimated Duration

4–6 days

---

## PR Checklist

- [ ] PendingActionsDrawer grep zero
- [ ] DashboardOfflineShell still works

---

## Implementation TODO

- [ ] Migrate each drawer to OverlayDrawer/OverlaySheet
- [ ] Consolidate offline UI
- [ ] Delete PendingActionsDrawer
- [ ] Update exports

---

## Implementation notes

<!-- Append after PR -->
