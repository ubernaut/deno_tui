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

## Completion Notes

- Documented the parity analysis in `docs/curses-webtui-parity.md`.
- Closed the highest-leverage missing curses primitive by adding `PadController` for off-screen scrollable text surfaces.
- Added renderer-neutral pad helpers for content measurement, row slicing, cursor clamping, keyboard scrolling, cursor
  reveal, and scrollbar pointer mapping.
- Added `padCommands()` and `bindPadCommands()` for command palettes, menus, keymaps, and plugin-driven apps.
- Exported Pad APIs through the terminal and web entrypoints via `src/components/mod.ts` and `src/app/mod.ts`.
- Updated the component catalog, README, repo overview, generated API reference, Pages assets, and screenshots.
- Covered the new public surface in widget helper and component catalog tests.
- Verified with API inventory, e2e, web Pages build, refreshed screenshots, and full `deno task health`.
