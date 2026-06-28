# grWizard

`app/grwizard.ts` is a responsive Deno front end for the real GeoRefine `grWizard` flow.

It discovers hardware and model candidates from `GeoRefineInternal`, builds the same run artifacts as the bash wizard,
launches the Docker workflow, tails GeoRefine and swarm output, and presents the run through a Neon-styled multi-panel
console.

## Run

```bash
deno task grwizard
```

Useful flags:

```bash
deno task grwizard -- --no-splash
deno task grwizard -- --dry-run
deno task grwizard -- --show-board
deno task grwizard -- --list-only
deno task grwizard -- --root /path/to/GeoRefineInternal
```

Typecheck with:

```bash
deno task grwizard:check
```

## Controls

- `Enter` or `Space`: dismiss the splash screen or advance the current launch step
- `Tab`: switch tabs
- On `Launch`: `Up`/`Down` or `j`/`k` move through the current list
- On `Launch`: `0-9` jump directly to numbered models, goals, or calibration profiles
- On `Launch`: `PageUp`/`PageDown`, `Home`, `End` move faster through long lists
- `b`, `Backspace`, or `Left`: go back one setup step
- `s`: start a real run from the review step
- `d`: prepare a dry run from the review step
- `r`: refresh GeoRefine context
- `c` or `x`: cancel the current task with confirmation
- `y`: confirm a cancel/quit prompt
- `n`: start a new run after completion
- `Esc`: close the cancel modal
- `q`: quit

The interface is keyboard-first. It uses full-frame redraws instead of the older retained-mode button/mouse path.
