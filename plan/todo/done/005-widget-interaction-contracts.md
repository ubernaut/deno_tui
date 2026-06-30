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

## Completed

- Added shared widget hit helpers in `src/components/interaction.ts` for stacked rows, disabled hit regions, z-order,
  and local mouse coordinates.
- Added direct mouse row selection to `ComboBoxController` and `RadioGroupController`.
- Added direct slider pointer mapping with snapped values through `sliderValueAt()`, `snapSliderValue()`, and
  `SliderController.handlePointer()`.
- Updated the `Slider` component so mouse presses set the track value while drags and scrolls keep their existing
  behavior.
- Updated component catalog capabilities for ComboBox and RadioGroup mouse support.
- Documented shared interaction helpers and controller mouse contracts in the README.

## Verification

- `deno test tests/widget_helpers.test.ts tests/advanced_widgets.test.ts tests/app_primitives.test.ts`
- `deno check mod.ts`
- `deno task component-catalog`
