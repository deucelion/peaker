# FAZ 34 — Storybook / Visual Catalog Plan

Planning only. **No Storybook installation or stories** until authorized by implementation waves.

Reference: [governance.md](./governance.md), [execution-plan.md](./execution-plan.md)

---

## Objectives

1. Single visual contract for default and custom organization branding  
2. Faster visual regression than full dashboard page loads  
3. Designer/QA preview without SQL or code changes (after Wave 3 admin + Wave 4 kill switch)  
4. Document semantic vs branded surfaces side-by-side  

---

## Setup (implementation TODO)

- [ ] Evaluate Storybook vs existing visual tooling in repo
- [ ] Add Storybook config (Wave 5 Phase 0 — before globals bind)
- [ ] `BrandingDecorator` — wraps stories with `BrandingUiProvider` + theme variants
- [ ] Document run command in root README or `docs/branding/storybook-plan.md`

---

## Theme variants (every applicable story)

| Variant | Description |
|---------|-------------|
| **Default organization** | `createDefaultBranding()` — Peaker purple |
| **Custom organization** | Primary `#112233` or staging test org from admin UI |
| **Kill switch** | Same as default (revision 0) |

**Dark mode:** Out of scope for FAZ 34 (Peaker dashboard is dark-only). FAZ 34.1 backlog if light theme added.

---

## Component catalog

### Buttons (Wave 5)

| Story | States |
|-------|--------|
| Primary | default, hover, disabled |
| Ghost | default, hover |
| Danger | default (semantic — frozen) |
| Load more | default, loading |

### Inputs (Wave 6)

| Story | States |
|-------|--------|
| Input | empty, filled, focus, disabled |
| Select | closed, focus |
| Textarea | empty, filled |
| Filter chip | inactive, active |

### Cards & badges (Wave 5)

| Story | States |
|-------|--------|
| ui-card | default |
| ui-card-chart | with chart shell |
| ui-compact-card | — |
| Badge neutral / success / warning / danger | semantic badges frozen |

### Tables (Wave 11)

| Story | States |
|-------|--------|
| DataTable | header, rows, hover |
| Empty inline | inside table |
| Pagination | first, middle, last page |
| Mobile card row | payments pattern |

### Charts (Wave 12)

| Story | States |
|-------|--------|
| ChartFrame | with data |
| ChartFrame empty | NoData |
| Tooltip | hover state (custom primary contrast) |
| Radar shell | PerformanceRadar frame only |

### Dialogs / modals (Wave 7–8)

| Story | States |
|-------|--------|
| OverlayDialog | center |
| Bottom sheet | mobile pattern |
| With footer | CompactModalFooter |
| Backdrop | dim + blur |

### Drawers / sheets (Wave 7, 9)

| Story | States |
|-------|--------|
| Right drawer | audit pattern |
| Bottom sheet | tahsilat mobile |
| Responsive sheet | desktop right |

### Menus (Wave 10)

| Story | States |
|-------|--------|
| Export menu | open, closed |
| Listbox | lesson picker pattern |

### Tooltips (Wave 10)

| Story | States |
|-------|--------|
| Chart tooltip | default + custom org |
| Contrast check | WCAG AA note in docs |

### Navigation (Wave 10)

| Story | States |
|-------|--------|
| Tabs | inactive, active |
| Breadcrumb | multi-segment |
| Sticky toolbar | WeeklyTopBar pattern |
| Page subnav | PageHeader tabs |

### Loading (Wave 13)

| Story | States |
|-------|--------|
| LoadingState | panel, inline |
| Skeleton stat | — |
| Skeleton table | — |
| Skeleton chart | line, bar, radar |
| QueryLoadingShell | dashboard variant |

### Empty states (Wave 13)

| Story | Variants |
|-------|----------|
| EmptyState | no_data, no_permission, onboarding, filtered_empty, error |
| Compact | table inline |

### KPI (Wave 13)

| Story | States |
|-------|--------|
| CompactMetricCard | neutral, purple, semantic tones |
| Org summary band chip | neutral, amber, red, violet |

### Branding provider (Wave 2)

| Story | Description |
|-------|-------------|
| Provider only | CSS vars visible on debug panel |
| Revision change | simulate re-fetch |

---

## Story requirements by wave

| Wave | Minimum new/updated stories |
|------|----------------------------|
| 2 | Provider decorator |
| 5 | Button, badge, card |
| 6 | Input, select, textarea, filter chip |
| 7 | Dialog, drawer, sheet shells (empty) |
| 8 | One domain modal example |
| 10 | Menu, tabs, breadcrumb, tooltip |
| 11 | Table, pagination |
| 12 | Chart frame, tooltip |
| 13 | Empty, skeleton, KPI |
| 14 | Full catalog snapshot baseline |

---

## Visual regression integration

- Tool (planned): Chromatic, Percy, or Playwright component screenshots  
- Baseline: default org at Wave 5  
- Second baseline: custom org at Wave 4 staging  
- Approval: see [ci-plan.md](./ci-plan.md) screenshot flow  

---

## File structure (planned)

```
.storybook/
  main.ts          # TODO Wave 5
  preview.tsx      # BrandingDecorator TODO
src/stories/branding/
  Button.stories.tsx
  Input.stories.tsx
  ...
```

**Do not create these files until Wave 5 implementation PR.**

---

## PR checklist (Storybook)

- [ ] Story added/updated for changed primitive
- [ ] Default + custom org variants
- [ ] Semantic stories unchanged when touching semantic components
- [ ] Visual diff reviewed (W5+ warn, W14 block)
