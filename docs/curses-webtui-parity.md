# Curses And WebTUI Parity

This fork now covers most of the practical surface expected from a batteries-included TUI toolkit: terminal lifecycle,
alternate-screen setup, keyboard/mouse/paste/focus input, focus traversal, command registries, menus, modals, windows,
responsive layouts, scroll areas, tables, forms, trees, virtual lists, themes, browser entrypoints, and deterministic
testing helpers.

## Closed In This Pass

- Added `PadController` as the curses-style off-screen text surface primitive.
- Added `renderPadRows()`, `measurePadContent()`, `normalizePadLines()`, and `clampPadCursor()` for renderer-neutral pad
  rendering and tests.
- Added cursor reveal, horizontal and vertical viewport offsets, keyboard scrolling, and scrollbar pointer mapping.
- Added `padCommands()` and `bindPadCommands()` so pads can be controlled from menus, command palettes, keymaps, and
  plugins.
- Exported the pad API through the terminal and web package entrypoints and added it to the component catalog.
- Added process-output terminal window primitives: `TerminalOutputController`, `ProcessSessionController`, and
  `terminalCommands()` for non-PTY command panes with stdout/stderr scrollback.

## Remaining Priorities

- PTY-backed interactive terminal windows for shell, curses apps, resize propagation, and detach/reattach workflows.
- Rich attributed text spans inside pads and text boxes, beyond the current string/ANSI-oriented helpers.
- Higher-level form validation flows that coordinate multiple fields, modals, status bars, and command surfaces.
- More browser accessibility metadata for web-rendered terminal widgets.
- A reference app shell that wires every primitive into one reusable window/menu/status layout rather than each demo
  owning its shell logic.
