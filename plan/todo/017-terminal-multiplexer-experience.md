# Rich Terminal Multiplexer Experience

## Goal

Move the Workbench shell from "basic PTY pane" toward a tmux-like terminal workspace that can comfortably host real
developer workflows.

## Needed Features

- Multiple shell sessions, each with a stable id, title, working directory, environment, backend id, and restart policy.
- Split shell panes inside one terminal window, including vertical/horizontal splits, nested splits, zoom, and focus
  movement between panes.
- Session tabs with rename, close, duplicate, restart, detach, attach, and reorder commands.
- Scrollback mode with search, copy selection, mouse-wheel history scrolling, page navigation, and a clear visual
  distinction between live input mode and scrollback/copy mode.
- Full xterm-style input support: Alt/meta chords, Ctrl keys, function keys, bracketed paste, mouse reporting modes,
  focus reporting, alternate screen handling, and application cursor/keypad modes.
- Better ANSI/terminal emulation: 256-color and truecolor SGR, cursor visibility/style, save/restore cursor, line
  insert/delete, scroll regions, OSC title sequences, hyperlinks, and common DEC private modes.
- Process lifecycle management: graceful stop, force kill, hung process detection, exit status badges, reconnect,
  detached session retention, and restore-on-workspace-open.
- Workspace persistence for shell layouts: saved sessions, cwd/env, pane geometry, active tab, shell renderer settings,
  and optional command templates.
- Backend abstraction parity: Sigma PTY, process fallback, tmux attach mode, remote terminal bridge, and browser remote
  shell clients should share one session model.
- Command palette integration for terminal actions and shell templates.
- File explorer integration: open shell here, copy path, run selected script/task, and reveal cwd.
- Performance: screen diffing, bounded scrollback memory, batched raw output writes, worker-backed parsing where useful,
  and responsive resizing under heavy output.
- Security and UX: explicit remote shell endpoint configuration for browser mode, clear local/remote labels, paste
  confirmation for multiline/high-risk commands, and configurable keybinding conflicts.
- Manual/e2e coverage: automated PTY smoke tests, tmux attach tests where available, browser remote-terminal protocol
  tests, and visual workbench smoke captures.

## Initial Acceptance

- A terminal workspace controller can manage more than one shell session.
- Workbench can create at least two shell sessions and switch between them without losing screen state.
- Browser mode exposes the same terminal-session model through the remote terminal protocol, even if GitHub Pages uses a
  safe mock endpoint by default.
- Docs explain the difference between Terminal Output, Shell, remote shell, and future multiplexer work.

## Progress

- Added `TerminalWorkspaceController` as the renderer-neutral session/tab model for multiple terminal descriptors,
  active session selection, rename, close, reorder, and serializable inspection.
- Added a renderer-neutral terminal pane layout tree to `TerminalWorkspaceController`, including row/column splits,
  active pane selection, pane close/collapse, split resizing, zoom state, session-pruning, and serializable layout
  inspection.
- Added `terminalWorkspacePaneRects()` to project split/zoomed pane trees into concrete terminal-cell rectangles for
  console and browser renderers.
- Added app command adapters for terminal workspace pane operations: split row/column, focus next/previous, zoom,
  resize, and close pane.
