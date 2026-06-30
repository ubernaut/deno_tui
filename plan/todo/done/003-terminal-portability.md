# Terminal Portability

## Goal

Make terminal behavior reliable across local terminals, SSH, tmux, common color depths, alternate screen behavior,
resizes, suspend/resume, and cleanup paths.

## Work

- Strengthen terminal capability and session planning.
- Document and test truecolor/256-color fallback paths.
- Add tmux/SSH capability tests where feasible.
- Harden alternate-screen, cursor, paste, focus, and mouse enable/disable sequencing.

## Acceptance Checks

- `deno test tests/runtime.test.ts tests/input_reader_keyboard.test.ts`
- Updated docs for terminal portability.

## Completed

- Added `detectTerminalEnvironment()`, `terminalEnvironmentDiagnostics()`, and terminal portability report helpers.
- Added tmux, SSH, UTF-8 locale, NO_COLOR, noninteractive, and color-depth diagnostics.
- Hardened terminal session setup so noninteractive plans emit no alternate-screen, cursor, paste, focus, or mouse
  escape sequences.
- Extended `deno task capabilities` JSON and text reports with terminal environment diagnostics.
- Documented tmux truecolor setup and noninteractive behavior in README and testing docs.

## Verification

- `deno test tests/runtime.test.ts tests/input_reader_keyboard.test.ts`
- `deno task capabilities -- --json`
