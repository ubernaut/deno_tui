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
- Added renderer-neutral session-tab lifecycle operations for duplicate, detach, and reattach, plus command adapter
  entries so command palettes and future workbench bindings can drive those actions without renderer-specific state.
- Added `TerminalScrollbackController` as a renderer-neutral copy/live-mode surface over `TerminalScreenController`,
  including clamped paging, search navigation, and line-range copy selection for future console and browser shell panes.
- Added terminal scrollback command adapters for copy-mode toggle/exit, line/page navigation, top/bottom jumps, search
  match movement, selection clearing, and selection copy actions.
- Wired `TerminalShellController` to expose a built-in scrollback/copy-mode controller and inspection snapshot, with
  viewport sizing kept in sync with shell resize events.
- Wired the API Workbench Shell window to render copy-mode scrollback rows, expose copy/top/bottom toolbar controls, and
  handle PageUp/PageDown/Home/End shell scrollback navigation without sending those keys to the PTY.
- Extended `TerminalScreenController` SGR handling to cover 256-color, truecolor, and bright foreground/background
  styles while preserving existing cell inspection shape.
- Added terminal cursor save/restore support for CSI `s`/`u` and legacy ESC `7`/`8` sequences.
- Added OSC 0/2 title parsing to `TerminalScreenController.inspect()` so shell titles can later drive workbench tabs.
- Added CSI insert/delete character and line operations for common screen-editing terminal output.
- Added DEC scroll-region support so full-screen shell apps can scroll bounded panes without disturbing fixed headers,
  footers, or surrounding terminal content.
- Added DEC private-mode inspection, including cursor visibility and mouse-reporting mode state, so render adapters can
  respond to terminal modes instead of discarding them.
- Added OSC 8 hyperlink parsing with per-cell hyperlink metadata for modern shell, test-runner, and build output.
- Added cursor style inspection for `CSI Ps SP q` so shell and editor cursor shape changes survive terminal parsing.
- Connected OSC terminal titles to shell inspection and workspace session descriptors while preserving explicit user
  renames.
- Added explicit PTY versus process-fallback metadata to terminal session inspection, workspace descriptors, status
  summaries, and the Workbench shell status line.
- Documented the terminal emulation strategy and scope split: architecture audit owns parser/runtime compatibility,
  while this todo owns tmux-like session and pane workflows.
- Added reverse-index, explicit scroll-up/scroll-down controls, and DEC origin-mode cursor addressing to
  `TerminalScreenController` so scroll-region-heavy full-screen apps behave more like xterm/curses screens.
- Added common xterm cursor and erase controls (`CNL`, `CPL`, `CHA`, `VPA`, `ECH`, erase-before display, and full-line
  erase) to reduce rendering drift in full-screen shell applications.
- Added more xterm cursor/text aliases (`CHT`, `CBT`, `HPA`, `HPR`, `VPR`, and `REP`) so shell applications that use
  tab-relative movement or repeat preceding graphic characters render correctly in the built-in screen model.
- Added Unicode graphic-unit reading and wide-cell cursor advancement so CJK/emoji output is not split into UTF-16
  surrogate cells and following shell text lands on the expected terminal column.
- Added configurable tab-stop handling (`ESC H`, `CSI g`, `CSI 3g`) so shell apps that customize tab columns are no
  longer forced through fixed 8-column stops.
- Added DEC autowrap mode handling (`CSI ? 7 h/l`) so full-screen apps can overwrite the right edge without forced line
  wrapping when they disable wrap mode.
- Added non-private insert/replace mode handling (`CSI 4 h/l`) so terminal output can insert characters into existing
  rows without emulating insert mode manually.
- Added single-character ESC index, next-line, and reset controls (`ESC D`, `ESC E`, `ESC c`) for older and curses-style
  terminal transcripts.
- Added legacy alternate-screen and cursor-save private modes (`CSI ? 47 h/l`, `CSI ? 1047 h/l`, `CSI ? 1048 h/l`, and
  save/restore cursor semantics for `CSI ? 1049 h/l`) so more curses/full-screen apps restore shell state correctly.
- Added bracketed-paste-aware raw input routing so embedded shells that negotiate DEC private mode 2004 receive pasted
  text framed as `CSI 200~`/`CSI 201~` while explicit raw paste buffers remain byte-preserving.
- Added a shared paste inspection and confirmation policy hook for raw terminal input routing, allowing terminal,
  multiplexer, and browser-remote adapters to require approval for multiline or control-character paste payloads before
  bytes are written to a child shell.
- Added SGR mouse routing for embedded shells that negotiate DEC private modes 1000/1002/1003 plus 1006, including local
  shell-body coordinate translation and byte-preserving raw mouse buffers.
- Added renderer-neutral terminal workspace session restart metadata and command-surface action support so spawnable
  session tabs can be reset for backend respawn while attach-only sessions remain protected.
- Added terminal workspace command-surface actions for close-session and move-session previous/next so session tabs now
  expose close, duplicate, restart, detach, attach, and reorder operations through renderer-neutral commands.
- Added a renderer-neutral terminal workspace rename-session command that accepts a caller-provided title, allowing
  command palettes and prompt/modal UIs to rename shell tabs without embedding prompt logic in the workspace model.
- Added optional geometry-aware pane focus commands for left/right/up/down movement. Render adapters can supply current
  pane rectangles and reuse the shared command layer for tmux-like directional focus while retaining next/previous pane
  cycling as a fallback.
- Added a versioned renderer-neutral terminal workspace snapshot API so shell sessions, active session, pane layout,
  zoom/focus state, and descriptors can be persisted and restored by console or browser adapters through one normalized
  contract.
- Added renderer-neutral previous/next session activation to terminal workspaces and command adapters so shell tabs can
  be cycled from keyboard bindings, command palettes, and browser/console renderers through the same command surface.
- Added `TerminalShellWorkspaceController`, a runtime bridge between terminal workspace descriptors and live
  `TerminalShellController` instances, so future console/web workbench adapters can manage multiple real shell sessions
  through one tested controller instead of hand-rolling shell maps.
- Added live shell workspace command adapters for new shell, start, stop, restart, previous/next session, close, and
  sync actions so command palettes and workbench menus can drive multi-session shell workspaces without renderer-local
  lifecycle code.
