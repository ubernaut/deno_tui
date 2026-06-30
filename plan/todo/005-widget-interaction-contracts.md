# Widget Interaction Contracts

## Goal

Make every widget expose consistent keyboard, mouse, focus, disabled, selected, active, and inspection behavior.

## Work

- Audit controllers and render helpers for consistency.
- Add shared interaction semantics and command adapters where missing.
- Ensure controls have predictable mouse hit regions and keyboard shortcuts.

## Acceptance Checks

- `deno test tests/widget_helpers.test.ts tests/advanced_widgets.test.ts tests/app_primitives.test.ts`
- Component catalog updated if capabilities change.
