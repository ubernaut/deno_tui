# Theme Standardization

## Goal

Ensure widgets, windows, overlays, demos, and web surfaces use semantic theme tokens consistently instead of one-off
style choices.

## Work

- Audit direct style/color choices in demos and reusable components.
- Add missing component theme variants.
- Keep theme preview/gallery coverage current.

## Acceptance Checks

- `deno test tests/dashboard_widgets.test.ts tests/app_primitives.test.ts`
- Theme demos/screenshots updated if visual output changes.
