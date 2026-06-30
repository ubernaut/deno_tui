# Curses And WebTUI Parity Gaps

## Goal

Identify and implement missing features needed for a robust curses-style Deno TUI and browser WebTUI package.

## Work

- Compare current APIs against practical curses/WebTUI expectations: screen lifecycle, pads/scroll regions, panels,
  overlays, input modes, key mapping, focus traversal, accessibility, renderer portability, and testability.
- Prioritize high-leverage missing primitives that can be implemented cleanly now.
- Keep additions modular, composable, documented, and covered by tests.
- Update README/API docs and package stability metadata if new public surfaces are added.

## Acceptance Checks

- Gap analysis documented in completion notes or docs.
- New features covered by unit and e2e tests.
- `deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=1`
- `deno task health`
