# Visual Regression And Manual Smoke

## Goal

Build repeatable visual/manual smoke coverage for terminal and web demos so UI polish stops regressing.

## Work

- Expand screenshot or terminal snapshot capture flows.
- Add scripted demo interactions for click, typing, resize, scroll, and modal flows.
- Track expected captures for major demos where practical.

## Acceptance Checks

- `deno task screenshots`
- New smoke tests or documented manual smoke command.

## Completed

- Added `deno task visual-smoke` backed by `scripts/visual_smoke.ts`.
- Added smoke targets for the demo gallery, window manager, component catalog, terminal command workflow, and capability
  report.
- Added unit tests for visual smoke output inspection and failure report formatting.
- Documented the smoke command alongside the screenshot regeneration workflow.
- Regenerated README screenshot JPEGs after the docs and capability output changes.

## Verification

- `deno task screenshots`
- `deno task visual-smoke`
- `deno test tests/visual_smoke.test.ts`
- `deno check scripts/visual_smoke.ts scripts/generate_screenshots.ts`
