# Wave 7 — Overlay Primitives Foundation

**FAZ reference:** 33.2c foundation  
**Wave doc:** [../wave-progress.md](../wave-progress.md)

---

## Objective

Ship overlay primitive shells (Modal, Drawer, Sheet, Menu, Tooltip token export), `OVERLAY_Z` registry, `ui-overlay-*` CSS, shared footer — **zero domain migration**.

---

## Scope

- Primitive components + CSS + selectors only
- CompactModalFooter refactor to shared footer slot
- Storybook empty shells

---

## Dependencies

- Waves 1, 2

---

## Blockers

- None for merge (unused primitives OK)

---

## Files

### New (planned)

- `src/components/ui/overlay/OverlayBackdrop.tsx`
- `src/components/ui/overlay/OverlayDialog.tsx`
- `src/components/ui/overlay/OverlayDrawer.tsx`
- `src/components/ui/overlay/OverlaySheet.tsx`
- `src/components/ui/overlay/OverlayMenu.tsx` (shell)
- `src/components/ui/overlay/overlayZIndex.ts`
- `src/components/ui/overlay/index.ts`
- `src/lib/ui/branding/overlaySelectors.ts`

### Modified (planned)

- `src/app/(dashboard)/globals.css` (`ui-overlay-*`, `ui-dialog`, `ui-drawer`)
- `src/components/mobile/CompactModalFooter.tsx`

---

## Validation

- [ ] Storybook per primitive
- [ ] Focus trap unit tests
- [ ] OVERLAY_Z documented
- [ ] No domain page behavior change

---

## Rollback

Delete overlay folder; revert globals overlay block.

---

## Risks

| Risk | Level |
|------|-------|
| a11y infrastructure | Medium |

---

## Testing

| Type | Planned |
|------|---------|
| Unit | Escape, focus trap, z-index enum |
| Storybook | Dialog, drawer, sheet, menu shells |

---

## Expected Outcome

Primitive API frozen before domain migration.

**Coverage increase:** +0% (enabler)

---

## Estimated LOC

~550–750

---

## Estimated Duration

5–7 days

---

## PR Checklist

- [ ] [ci-plan.md](../ci-plan.md) OVERLAY_Z grep rules noted for Wave 8
- [ ] No domain modal switched yet

---

## Implementation TODO

- [ ] All primitive components
- [ ] overlaySelectors
- [ ] OVERLAY_Z registry
- [ ] CompactModalFooter → overlay footer pattern
- [ ] Storybook shells

---

## Implementation notes

<!-- Append after PR -->
