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
