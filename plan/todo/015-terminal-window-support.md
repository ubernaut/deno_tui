# Terminal Window Support

## Goal

Add terminal-capable workbench windows so users can run commands inside managed windows, route keyboard input to the
active terminal, resize sessions with the window manager, and eventually use the workbench like a lightweight tmux-style
workspace.

## Options

- **Option A: command output windows.** Spawn commands with `Deno.Command`, stream stdout/stderr into a
  `LogViewerController`-style buffer, and expose stop/restart/clear/follow actions. This is the fastest useful path and
  works well for build logs, test runs, long-running servers, and task launchers, but it is not a real interactive shell.
- **Option B: subprocess stdin/stdout windows.** Keep `Deno.Command` pipes open, route focused key presses to stdin, and
  render output as a scrollback pane. This supports simple REPLs and prompts, but without a PTY many terminal programs
  will not detect an interactive terminal, cursor movement and full-screen apps will be unreliable, and window resizing
  cannot be reported as terminal geometry.
- **Option C: PTY-backed terminal windows.** Add a small PTY backend abstraction and bind it to each workbench window.
  This is the correct path for shell, vim, htop, curses apps, alternate screen, resize propagation, and tmux-like usage.
  It likely needs an optional dependency or platform-specific adapter because Deno does not expose a native PTY API.
- **Option D: external tmux integration.** Treat tmux as the session engine and make workbench windows attach to tmux
  panes/sessions through a PTY bridge. This gives robust detach/reattach and mature process control, but makes tmux a
  runtime dependency and pushes layout authority partly outside the workbench.

## Recommended Path

Start with Option A as an incremental library feature, then build the runtime seams needed for Option C. Avoid committing
to Option D unless persistent remote sessions are the main product goal.

## Work

### Phase 1: Process Output Windows

- Add `src/runtime/process_session.ts` with a controller for command lifecycle, stdout/stderr streaming, exit status,
  cancellation, restart, and bounded scrollback.
- Add `src/components/terminal_output.ts` or extend the log viewer with terminal-specific metadata: stream source,
  running/exited state, exit code, follow mode, and clear/copy-ready inspection.
- Add command-surface helpers under `src/app/` for `terminal.run`, `terminal.stop`, `terminal.restart`,
  `terminal.clear`, `terminal.toggleFollow`, and `terminal.copyCommand`.
- Update `app/api_workbench.ts` and/or `examples/windowing_system_launcher.ts` to open command output windows through
  `WindowManagerController` instead of launching a task only after the workbench exits.
- Preserve the existing terminal session cleanup behavior from `src/runtime/terminal_session.ts`; process windows should
  not interfere with the host app alternate screen, mouse, paste, or cursor teardown.

### Phase 2: Interactive Stdin Routing

- Define focus rules for terminal windows: when a terminal window is active, printable keys and paste events go to the
  child process; workbench shortcuts still require an explicit prefix, command palette, or reserved key chord.
- Add a key-routing adapter from decoded `KeyPressEvent`/paste events to process stdin bytes.
- Add terminal-window mode indicators in title bars: normal workbench focus, insert/raw child-input mode, process
  running, exited, failed, or detached.
- Add tests for key routing, paste routing, stop/restart behavior, and preserving global workbench commands.

### Phase 3: PTY Backend

- Introduce `TerminalBackend` and `TerminalSessionHandle` interfaces that hide platform-specific details:
  `spawn(command, args, env, cwd, cols, rows)`, `write(data)`, `resize(cols, rows)`, `kill(signal)`, output events,
  exit events, and disposal.
- Provide a `ProcessBackend` implementation using `Deno.Command` for Option A/B behavior.
- Add a PTY implementation behind an optional import or adapter package. Candidate approaches:
  `deno_pty`, a Node compatibility package if stable under Deno, a small Rust/Go sidecar, or tmux/control-mode as a
  backend.
- Add a terminal screen model. At minimum support ANSI parsing into cell rows, scrollback, cursor position, alternate
  screen, erase/move sequences, SGR style spans, and resize reflow. Prefer a maintained parser if compatible with Deno.
- Wire `WindowManagerController.layout()` dimensions into backend resize calls so focused/fullscreen/tiled terminal
  windows update their child terminal size.

### Phase 4: Tmux-Like Workspace Behavior

- Add terminal window creation from templates: shell, `deno task`, arbitrary command, project task, and attach existing
  session.
- Add split/window commands that map naturally to the current window manager: new terminal, close, rename, next/previous,
  fullscreen, tile, minimize, restore, and move order.
- Add session persistence metadata: command, cwd, env overrides, title, scrollback policy, restart policy, and whether
  the window is reconnectable.
- Add optional detach/reattach support if the backend can keep sessions alive outside the workbench process.
- Add status bar summaries for active process, exit code, cwd, backend type, dimensions, and detached/running state.

### Phase 5: Web And Remote Runtime

- Reuse `src/web/remote_terminal.ts` as the protocol boundary for browser-hosted terminal windows.
- Add a server-side bridge that connects remote terminal messages to the same backend interface used by local terminal
  windows.
- Keep browser demos safe by default: mock terminal windows or connect only to an explicitly configured local bridge.
- Add remote resize, binary data, paste, focus, error, and close coverage.

## Open Decisions

- Choose whether terminal windows are a library primitive, a workbench-only feature, or both.
- Choose a PTY provider. This decision controls install friction, platform support, and how close the result can get to
  tmux.
- Decide whether global shortcuts use a prefix key when a terminal is focused, similar to tmux, or whether terminal
  windows require toggling a raw-input mode.
- Decide whether scrollback is owned by the terminal screen model, the backend, or both.
- Decide how much ANSI support is required for the first interactive milestone.

## Acceptance Checks

- Unit tests for process lifecycle, scrollback limits, exit inspection, and cancellation.
- Unit tests for key/paste routing and global shortcut escape behavior.
- Window manager tests proving terminal windows resize, fullscreen, minimize, restore, close, and preserve focus
  correctly.
- `deno test tests/runtime.test.ts tests/window_manager_usability.test.ts tests/windowing_system_launcher.test.ts`
- `deno check app/api_workbench.ts examples/windowing_system_launcher.ts`
- Manual smoke: open two command windows, run independent commands, switch focus, resize/fullscreen, stop one process,
  clear scrollback, and exit the workbench with terminal state restored.

## Risks

- A non-PTY subprocess is useful but will disappoint users expecting shell/curses behavior.
- PTY packages may be platform-sensitive, especially on Windows and in sandboxed CI.
- ANSI parsing can grow quickly; constrain the first parser target to common shell output before claiming full terminal
  emulation.
- Raw-input routing can conflict with existing workbench shortcuts unless the focus contract is explicit and tested.
