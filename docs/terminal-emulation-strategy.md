# Terminal Emulation Strategy

This fork uses a local terminal screen model for the Workbench shell, remote terminal bridge, demos, and tests. The
current strategy is to keep extending the local parser while its scope remains testable and renderer-neutral.

## Current Decision

Continue expanding `TerminalScreenController` for the near term instead of embedding a maintained VT parser immediately.

The local parser is already covered by fixture tests for common shell output, curses-style alternate-screen output,
truecolor/256-color SGR, scroll regions, insert/delete operations, cursor save/restore, OSC titles, OSC 8 hyperlinks,
cursor style, and DEC private modes. It also exposes inspection fields that the rest of this library needs: title,
cursor state, mouse-reporting modes, hyperlinks, alternate-screen state, and cell styles.

## Why Not Embed Yet

A maintained VT parser is still the right long-term escape hatch if this project needs broad xterm parity. It should be
embedded when any of these become true:

- Full-screen apps expose parser bugs that cannot be reproduced with small local fixtures.
- We need broad DEC/xterm compatibility beyond the subset used by shells, editors, pagers, and dashboard apps.
- Worker-backed parsing becomes necessary to keep the UI responsive under sustained high-output PTY sessions.
- Parser maintenance starts taking time away from renderer, widget, layout, and backend work.

Until then, the local parser has useful advantages: no native dependency, deterministic tests, straightforward cell
inspection, and the same behavior in terminal, browser, and remote bridge contexts.

## Scope Boundaries

`plan/todo/018-top-to-bottom-architecture-code-audit.md` tracks library-quality terminal emulation work: parser
coverage, backend metadata, diagnostics, test fixtures, and health-gated behavior.

`plan/todo/017-terminal-multiplexer-experience.md` tracks tmux-like product behavior: multiple sessions, tabs, pane
splits, scrollback/copy mode, shell command palette actions, detach/attach, remote clients, and manual workflow tests.

When a task changes the terminal byte parser, screen model, backend inspection, or reusable runtime API, keep it in the
architecture audit. When it changes how a user manages shell sessions and panes in the Workbench, keep it in the
multiplexer todo.

## Test Policy

Every new escape-sequence family should include:

- A small focused unit test in `tests/terminal_screen.test.ts`.
- A realistic transcript fixture when behavior affects shell, editor, pager, or curses-style output.
- A renderer-neutral inspection assertion when UI adapters need to respond to the parsed state.

Optional PTY smoke tests should stay separate from default package imports and skip cleanly when the Sigma PTY adapter,
native permissions, or a compatible host shell are unavailable.
