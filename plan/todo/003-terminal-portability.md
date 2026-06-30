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
