# GitHub Pages Build

## Goal

Regenerate the GitHub Pages build under `docs/` with the updated browser demos, defaulting to the Neon Exodus/API
workbench portfolio expected by the fork.

## Work

- Run the Pages build.
- Confirm generated docs assets reference the updated demos.
- Verify no stale SVG screenshot/image artifacts are introduced.

## Acceptance Checks

- `deno task web:pages:build`
- `git diff --check`
- Pages output committed and pushed.
