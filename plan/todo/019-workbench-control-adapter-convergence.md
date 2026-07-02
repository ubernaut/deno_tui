# Workbench Control Adapter Convergence

## Goal

Continue reducing duplicated API Workbench controls-panel behavior between the terminal and browser adapters while
keeping renderer-specific paint and hit-stack plumbing local.

## Work

- [x] Move inline stepper hit placement into a shared app-level helper with caller-owned output storage.
- [x] Migrate the browser controls panel to the shared wrapped option-token layout used by the terminal controls panel.
- [x] Extract shared single-line control segment and hit projection, then route terminal/browser `writeControl` helpers
      through it.
- [x] Extract shared slider/progress track projection and slider set-hit geometry, then route terminal/browser controls
      through it.
- [x] Extract shared dropdown popover rectangle projection so terminal and browser adapters keep matching overlay
      placement.
- [x] Extract shared multiline textbox projection for wrapping, cursor reveal, body rows, and focus hit geometry.
- [ ] Extract a renderer-neutral controls row projection for button, slider, checkbox, radio, combo, dropdown, input,
      textbox, stepper, and progress rows.
- [ ] Add adapter-parity tests that compare terminal/web controls row geometry and hit regions from the shared
      projection.
- [ ] Use the shared projection in both workbench adapters, leaving only ANSI/string-frame painting local.

## Acceptance

- [ ] Console and browser controls panels derive row/hit geometry from the same projection helper.
- [ ] `deno task health` passes.
