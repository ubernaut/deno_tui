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

## Completion Notes

- Added a standard component theme map for the full public widget catalog, plus helpers to compose and audit it.
- Wired the built-in packs and grWizard-derived packs to use semantic component defaults while preserving richer
  grWizard overrides.
- Expanded the theme gallery demo to preview broader widgets and report standard coverage.
- Verified with `deno test tests/dashboard_widgets.test.ts tests/app_primitives.test.ts`,
  `deno check mod.ts examples/theme_gallery.ts examples/app_shell.ts examples/batteries_included.ts examples/adopter_workbench.ts`,
  `deno task theme-gallery -- brass`, `deno task api-inventory`, and `deno task api-reference`.
