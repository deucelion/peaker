# Wave 6 — Form Surfaces

**FAZ reference:** 33.2b  
**Wave doc:** [../wave-progress.md](../wave-progress.md)

---

## Objective

Bind `ui-input`, `ui-select`, `ui-textarea`, FilterBar shell; migrate MoneyAmountInput focus; branded info tone in QUERY_TONE_CLASS only.

---

## Scope

- globals form classes, FilterBar, MoneyAmountInput, queryState purple tone → var
- Out of scope: native date/month pickers (platform chrome)

---

## Dependencies

- **Wave 5 Phase A** (globals bind)

---

## Blockers

- Wave 5 merged

---

## Files

### Modified (planned)

- `src/app/(dashboard)/globals.css` (form block)
- `src/components/ui/layout/FilterBar.tsx`
- `src/components/privateLessons/MoneyAmountInput.tsx`
- `src/lib/ui/queryState.ts` (purple tone only)

---

## Validation

- [ ] Focus ring uses primary token
- [ ] Semantic finance/success styling unchanged
- [ ] Storybook input stories

---

## Rollback

Revert globals form block.

---

## Risks

| Risk | Level |
|------|-------|
| Wide form usage (~240 inputs) | Medium |

---

## Testing

| Type | Planned |
|------|---------|
| Playwright | Focus border color |
| Visual | Audit filter panel, profile form |

---

## Expected Outcome

Form layer on token rails.

**Coverage increase:** +5–8%

---

## Estimated LOC

~120–200

---

## Estimated Duration

2–3 days

---

## PR Checklist

- [ ] Semantic input colors verified
- [ ] Storybook inputs updated

---

## Implementation TODO

- [ ] globals ui-input, ui-select, ui-textarea
- [ ] FilterBar + FilterChip (if not done in W5)
- [ ] MoneyAmountInput focus ring
- [ ] QUERY_TONE_CLASS purple → var

---

## Implementation notes

<!-- Append after PR -->
