# Workbench PTY Shell Window

## Goal

Expose a regular OS shell inside the API Workbench so the terminal can be used like a normal interactive shell when a
PTY backend is available.

## Scope

- Add a `TerminalShellController` that wraps `TerminalBackend` sessions, streams raw output into
  `TerminalScreenController`, and routes keyboard/paste input through the existing terminal input helpers.
- Prefer the optional Sigma PTY backend for real prompt/cursor behavior, with a clearly labeled process-backed fallback
  when PTY support is unavailable.
- Add a Workbench window/menu option for the shell and keep it distinct from the existing process-output terminal demo.
- Resize the shell with its window content area.
- Mirror the browser story through `src/web/remote_terminal.ts` rather than exposing local stdio directly from the
  standalone web package.

## Acceptance

- `deno check app/api_workbench.ts mod.ts mod.web.ts`
- Focused runtime tests for raw data streaming, resize, and key routing.
- Manual Workbench smoke: open shell window, run a simple command, use Ctrl+C in the shell, resize the terminal, close
  the shell window.

## Completed

- Added `TerminalShellController` with raw backend data streaming into `TerminalScreenController`.
- Extended terminal backends with raw `onData` callbacks while preserving line-oriented output scrollback.
- Generalized terminal input routing so it can write to process sessions or shell/session handles.
- Added the API Workbench `Shell` window to the New menu. It auto-starts with the optional Sigma PTY backend when
  available and falls back to a process backend with clear status labeling.
- Verified with focused tests plus tmux smoke runs that opened the Shell pane and executed
  `echo WORKBENCH_SHELL_OK`.
