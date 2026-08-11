# Storybook visual baselines (Wave 14)

Default-organization screenshots for the branding Storybook catalog.

## Generate / update baselines

```bash
npm run storybook
# separate terminal:
BRANDING_VISUAL_UPDATE=1 STORYBOOK_URL=http://127.0.0.1:6006 npm run test:e2e:branding:visual
```

## CI

Visual regression runs when `STORYBOOK_URL` is provided in the branding CI workflow.
Without a running Storybook instance, tests are skipped (non-blocking locally).

## Approval

Default-org diffs > 0.5% pixels fail unless intentionally updated via `BRANDING_VISUAL_UPDATE=1`.
